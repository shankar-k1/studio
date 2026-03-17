import time
import os
from typing import Optional

from .database_module import DatabaseModule
from .scrubbing_engine import ScrubbingEngine
from .cache_engine import cache_engine
from .logging_system import logger


def _pop_next_job_id() -> Optional[int]:
    """
    Pops the next job id from the lightweight queue.
    Prefer Redis list semantics when available via CacheEngine,
    but fall back to an in-memory list stored in cache.
    """
    queue_key = "scrub_jobs_queue"
    try:
        queue = cache_engine.get(queue_key) or []
        if not queue:
            return None
        job_id = queue.pop(0)
        cache_engine.set(queue_key, queue, expire=None)
        return int(job_id)
    except Exception as e:
        print(f"ScrubWorker Queue Error: {e}")
        return None


def process_job(job_id: int):
    """
    Processes a single scrub job:
    - Loads MSISDN inputs in chunks
    - Runs ScrubbingEngine.perform_full_scrub
    - Persists results via DatabaseModule.save_verified_scrub_results
    - Updates job status and metrics
    """
    db = DatabaseModule()
    engine = ScrubbingEngine()

    job = db.get_scrub_job(job_id)
    if not job:
        logger.log("backend", "error", f"Scrub job {job_id} not found", "scrub_worker")
        return

    logger.log("backend", "info", f"Starting scrub job {job_id}", "scrub_worker")
    db.update_scrub_job_status(job_id, status="RUNNING", mark_started=True)

    try:
        # For now we load all inputs at once; DatabaseModule.load_scrub_job_inputs
        # yields chunks so this will still be memory-safe for very large bases.
        all_msisdns = []
        for chunk in db.load_scrub_job_inputs(job_id):
            all_msisdns.extend(chunk)

        operator = job.get("operator")
        import json

        options = json.loads(job.get("options_json") or "{}")

        # Run full scrub (async method invoked via asyncio.run)
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        final_base, report = loop.run_until_complete(
            engine.perform_full_scrub(all_msisdns, target_operator=operator, options=options)
        )
        loop.close()

        # Persist results
        save_ok, table_name = db.save_verified_scrub_results(final_base)
        if not save_ok:
            raise RuntimeError(f"Failed to save scrub results: {table_name}")

        db.update_scrub_job_status(
            job_id,
            status="COMPLETED",
            final_count=len(final_base),
            results_table=table_name,
        )
        logger.log(
            "backend",
            "success",
            f"Scrub job {job_id} completed. Final count: {len(final_base)} (table: {table_name})",
            "scrub_worker",
        )
    except Exception as e:
        err_msg = str(e)
        logger.log(
            "backend",
            "error",
            f"Scrub job {job_id} failed: {err_msg}",
            "scrub_worker",
        )
        db.update_scrub_job_status(
            job_id,
            status="FAILED",
            error_message=err_msg,
        )


def run_forever(poll_interval: int = 5):
    """
    Long-running worker loop.
    Intended to be started as a separate process:

        python -m modules.scrub_worker
    """
    logger.log("backend", "info", "Scrub worker started", "scrub_worker")
    while True:
        job_id = _pop_next_job_id()
        if job_id is None:
            time.sleep(poll_interval)
            continue
        process_job(job_id)


if __name__ == "__main__":
    interval = int(os.getenv("SCRUB_WORKER_POLL_INTERVAL", "5"))
    run_forever(poll_interval=interval)

