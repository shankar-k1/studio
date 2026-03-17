import os
import time
import random
import string
import requests

API_BASE = os.getenv("API_BASE", "http://localhost:8000")


def random_msisdn():
  return "0803" + "".join(random.choice(string.digits) for _ in range(7))


def login(username: str, password: str) -> str:
  res = requests.post(f"{API_BASE}/login", json={"username": username, "password": password})
  res.raise_for_status()
  data = res.json()
  return data["token"]


def submit_scrub_job(token: str, size: int = 100000):
  msisdns = [random_msisdn() for _ in range(size)]
  headers = {"Authorization": f"Bearer {token}"}
  res = requests.post(
    f"{API_BASE}/scrub",
    headers=headers,
    json={"msisdn_list": msisdns, "options": {"dnd": True, "sub": True, "unsub": True, "operator": True}},
  )
  res.raise_for_status()
  return res.json()["job_id"]


def poll_job(token: str, job_id: int, timeout: int = 600):
  headers = {"Authorization": f"Bearer {token}"}
  start = time.time()
  while time.time() - start < timeout:
    res = requests.get(f"{API_BASE}/scrub-job/{job_id}", headers=headers)
    if res.status_code == 404:
      time.sleep(2)
      continue
    res.raise_for_status()
    job = res.json()["job"]
    print(f"Job {job_id}: {job['status']} (final_count={job.get('final_count')})")
    if job["status"] in ("COMPLETED", "FAILED"):
      return job
    time.sleep(5)
  raise TimeoutError(f"Job {job_id} did not finish within {timeout}s")


def main():
  """
  Simple load test:
  - Logs in as multiple users (assumed to exist)
  - Submits one scrub job per user
  - Polls all jobs until completion
  """
  users = [("user1", "password1"), ("user2", "password2"), ("user3", "password3")]
  tokens = []
  for u, p in users:
    try:
      tokens.append(login(u, p))
      print(f"Logged in as {u}")
    except Exception as e:
      print(f"Login failed for {u}: {e}")

  jobs = []
  for idx, token in enumerate(tokens):
    try:
      job_id = submit_scrub_job(token, size=100000)  # 100k per user as a smoke test
      jobs.append((token, job_id))
      print(f"Submitted job {job_id} for user index {idx}")
    except Exception as e:
      print(f"Failed to submit job for user index {idx}: {e}")

  for token, job_id in jobs:
    try:
      poll_job(token, job_id)
    except Exception as e:
      print(f"Job {job_id} error: {e}")


if __name__ == "__main__":
  main()

