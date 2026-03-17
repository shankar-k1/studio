import asyncio
import concurrent.futures
import multiprocessing
from typing import List, Callable, Any
from functools import partial

class LoadDistributor:
    """
    Handles distribution of heavy computational tasks across CPU cores.
    Perfect for large-scale MSISDN scrubbing.
    """
    def __init__(self):
        # Default to all available cores, but guard against environments
        # where process pools or semaphore limits are restricted.
        try:
            self.num_cores = multiprocessing.cpu_count()
        except Exception:
            self.num_cores = 1

        try:
            # Use a ProcessPoolExecutor for CPU-bound tasks where allowed
            self.executor = concurrent.futures.ProcessPoolExecutor(max_workers=self.num_cores)
            print(f"DEBUG: LoadDistributor initialized with {self.num_cores} process workers.")
        except Exception as e:
            # Fallback to a ThreadPoolExecutor in constrained environments
            print(f"WARNING: ProcessPoolExecutor unavailable ({e}). Falling back to ThreadPoolExecutor.")
            self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=self.num_cores)

    async def distribute_task(self, func: Callable, data_list: List[Any], chunk_size: int = 10000) -> List[Any]:
        """
        Splits a large list into chunks and processes them in parallel across processes.
        """
        if len(data_list) <= chunk_size:
            # No need to distribute for small loads
            return func(data_list)

        # Create chunks
        chunks = [data_list[i:i + chunk_size] for i in range(0, len(data_list), chunk_size)]
        loop = asyncio.get_event_loop()
        
        # Dispatch to process pool
        # Note: func must be picklable (module level function)
        tasks = [
            loop.run_in_executor(self.executor, partial(func, chunk))
            for chunk in chunks
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Flatten results
        return [item for sublist in results for item in sublist]

    def shutdown(self):
        self.executor.shutdown()

# Shared instance
load_distributor = LoadDistributor()
