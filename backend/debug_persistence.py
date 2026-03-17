
import os
import sys
from modules.database_module import DatabaseModule

db = DatabaseModule()
if not db.engine:
    print("Database not initialized")
    sys.exit(1)

test_msisdns = [f"237670000{i}" for i in range(100)]
job_id = db.create_scrub_job("test_user", len(test_msisdns), None, {"dnd": True})
print(f"Created job_id: {job_id}")

success = db.add_scrub_job_inputs(job_id, test_msisdns)
if success:
    print("Successfully persisted inputs")
else:
    print(f"Failed to persist: {db.last_error}")

# Cleanup
from sqlalchemy import text
with db.engine.connect() as conn:
    conn.execute(text(f"DELETE FROM scrub_jobs WHERE id = {job_id}")) # cascades to inputs
    conn.commit()
