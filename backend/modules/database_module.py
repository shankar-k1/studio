import os
from sqlalchemy import create_engine, text, bindparam
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

class DatabaseModule:
    def __init__(self):
        self.db_type = os.getenv("DB_TYPE", "postgresql") 
        # Consolidate URL and Handle Fallbacks
        self.url = os.getenv("DATABASE_URL")
        self.init_error: str = "" # Initialize as string
        self.last_error: str = "" # Initialize for tracking recent operations
        if self.url:
            if self.url.startswith("postgres://"):
                self.url = self.url.replace("postgres://", "postgresql://", 1)
            
            # Robust fix: Strip unsupported 'prepare_threshold' if it exists in the env var
            if "prepare_threshold" in self.url:
                import re
                self.url = re.sub(r'[&?]prepare_threshold=[^&]+', '', self.url)
                # Cleanup if ? was the only thing left
                if self.url.endswith('?'):
                    self.url = self.url[:-1]
        
        if not self.url:
            user = os.getenv("DB_USER", "postgres")
            password = os.getenv("DB_PASS", "")
            host = os.getenv("DB_HOST", "localhost")
            port = os.getenv("DB_PORT", "5432")
            dbname = os.getenv("DB_NAME", "postgres")
            self.url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        
        url = self.url
        self.init_error = ""
            
        try:
            # Handle PostgreSQL Connectors (Supabase/Render/Postgres)
            if url and ("postgresql" in url or "postgres" in url):
                # Ensure SQLAlchemy uses the psycopg2 driver explicitly
                if "://" in url and not url.startswith("postgresql+psycopg2"):
                    url = url.replace("://", "+psycopg2://", 1)
                
                # Ensure sslmode=require for cloud services
                if "supabase" in url or "render" in url:
                    if "sslmode" not in url:
                        if "?" not in url: url += "?sslmode=require"
                        else: url += "&sslmode=require"
                
                self.engine = create_engine(
                    url, 
                    pool_pre_ping=True,
                    pool_recycle=300, # Recycle connections every 5 mins
                    pool_timeout=30,
                    connect_args={"sslmode": "require"} if "sslmode=require" in url else {}
                )
            elif url:
                self.engine = create_engine(url)
            else:
                self.engine = None
        except Exception as e:
            self.init_error = str(e)
            print(f"❌ DATABASE INITIALIZATION ERROR: {e}")
            self.engine = None
            
        if self.engine:
            try:
                # Test connection with a strict timeout to avoid hanging the app
                print(f"DEBUG: Testing DB connection to {self.engine.url.host}...")
                with self.engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print("DEBUG: DB Connection Successful.")
                self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
                self._initialize_tables()
            except Exception as e:
                self.init_error = f"Conn Test Failed: {str(e)}"
                print(f"❌ DATABASE CONNECTION ERROR: {e}")
                # We don't set engine to None here, we might want to retry later or show error in UI

    def _initialize_tables(self):
        """Creates the necessary tables if they don't exist (PostgreSQL syntax)."""
        # PostgreSQL uses SERIAL for auto-increment and different table creation checks
        queries = [
            """
            CREATE TABLE IF NOT EXISTS obdscheduling_details (
                id SERIAL PRIMARY KEY,
                obd_name VARCHAR(255) NOT NULL,
                flow_name VARCHAR(255) NOT NULL,
                msc_ip VARCHAR(50) NOT NULL,
                cli VARCHAR(50) NOT NULL,
                scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS dnd_list (
                id SERIAL PRIMARY KEY,
                msisdn VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                service_id VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS unsubscriptions (
                id SERIAL PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS campaign_targets (
                id SERIAL PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS user_details (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_dnd_msisdn ON dnd_list(msisdn);",
            "CREATE INDEX IF NOT EXISTS idx_subs_msisdn ON subscriptions(msisdn);",
            "CREATE INDEX IF NOT EXISTS idx_unsubs_msisdn ON unsubscriptions(msisdn);",
            "CREATE INDEX IF NOT EXISTS idx_camp_msisdn ON campaign_targets(msisdn);",
            """
            CREATE TABLE IF NOT EXISTS email_sync_log (
                id SERIAL PRIMARY KEY,
                email_uid VARCHAR(255) UNIQUE NOT NULL,
                filename VARCHAR(255),
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS email_sourced_targets (
                id SERIAL PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                email_uid VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS scrub_jobs (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                operator VARCHAR(50),
                options_json TEXT,
                total_input BIGINT DEFAULT 0,
                final_count BIGINT DEFAULT 0,
                results_table VARCHAR(255),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS scrub_job_inputs (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES scrub_jobs(id) ON DELETE CASCADE,
                msisdn VARCHAR(20) NOT NULL
            )
            """
        ]
        try:
            with self.engine.connect() as connection:
                for query in queries:
                    connection.execute(text(query))
                connection.commit()
                
            # Create a default user if empty
            with self.engine.connect() as connection:
                count = connection.execute(text("SELECT COUNT(*) FROM user_details")).scalar()
                if count == 0:
                    self.create_admin_user("admin", "admin123")
                    self.create_admin_user("admin@vocal-sync.com", "admin")
        except Exception as e:
            print(f"Table Initialization Error: {e}")

    def create_scrub_job(self, username: str, total_input: int, operator: str | None, options: dict | None):
        """Creates a scrub job metadata entry and returns its ID."""
        from datetime import datetime
        import json
        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text("""
                        INSERT INTO scrub_jobs (username, status, operator, options_json, total_input, created_at)
                        VALUES (:username, :status, :operator, :options_json, :total_input, :created_at)
                        RETURNING id
                    """),
                    {
                        "username": username,
                        "status": "PENDING",
                        "operator": operator,
                        "options_json": json.dumps(options or {}),
                        "total_input": int(total_input or 0),
                        "created_at": datetime.utcnow(),
                    },
                )
                job_id = result.scalar()
                conn.commit()
                return job_id
        except Exception as e:
            self.last_error = f"Create Scrub Job Error: {str(e)}"
            print(self.last_error)
            return None

    def add_scrub_job_inputs(self, job_id: int, msisdns: list[str]):
        """Persists the raw MSISDN base for a job in a separate table (chunk-safe)."""
        if not msisdns:
            return True
        
        # Use smaller chunks for execute_values to stay within query size limits
        chunk_size = 50000
        msisdn_chunks = [msisdns[i:i + chunk_size] for i in range(0, len(msisdns), chunk_size)]
        
        raw_conn = None
        try:
            raw_conn = self.engine.raw_connection()
            cursor = raw_conn.cursor()
            from psycopg2.extras import execute_values
            
            for chunk in msisdn_chunks:
                data = [(job_id, str(m)) for m in chunk if m]
                if not data:
                    continue
                execute_values(
                    cursor,
                    "INSERT INTO scrub_job_inputs (job_id, msisdn) VALUES %s",
                    data,
                    page_size=10000,
                )
                raw_conn.commit()
            
            cursor.close()
            return True
        except Exception as e:
            err_msg = f"Failed to persist scrub job inputs: {str(e)}"
            self.last_error = err_msg
            print(f"ERROR: {err_msg}")
            if raw_conn:
                try:
                    raw_conn.rollback()
                except:
                    pass
            return False
        finally:
            if raw_conn:
                try:
                    raw_conn.close()
                except:
                    pass

    def load_scrub_job_inputs(self, job_id: int, chunk_size: int = 100000):
        """Generator yielding MSISDN chunks for a job to avoid loading entire base in memory."""
        if not self.engine:
            return
        offset = 0
        while True:
            with self.engine.connect() as conn:
                rows = conn.execute(
                    text(
                        """
                        SELECT msisdn FROM scrub_job_inputs
                        WHERE job_id = :job_id
                        ORDER BY id
                        OFFSET :offset LIMIT :limit
                        """
                    ),
                    {"job_id": job_id, "offset": offset, "limit": chunk_size},
                ).fetchall()
                if not rows:
                    break
                yield [r[0] for r in rows]
                offset += len(rows)

    def update_scrub_job_status(
        self,
        job_id: int,
        status: str,
        final_count: int | None = None,
        results_table: str | None = None,
        error_message: str | None = None,
        mark_started: bool = False,
    ):
        """Updates status and optional metadata of a scrub job."""
        from datetime import datetime
        fields = ["status = :status"]
        params = {"job_id": job_id, "status": status}
        if final_count is not None:
            fields.append("final_count = :final_count")
            params["final_count"] = int(final_count)
        if results_table is not None:
            fields.append("results_table = :results_table")
            params["results_table"] = results_table
        if error_message is not None:
            fields.append("error_message = :error_message")
            params["error_message"] = error_message
        if mark_started:
            fields.append("started_at = :started_at")
            params["started_at"] = datetime.utcnow()
        if status in ("COMPLETED", "FAILED"):
            fields.append("completed_at = :completed_at")
            params["completed_at"] = datetime.utcnow()
        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text(
                        f"UPDATE scrub_jobs SET {', '.join(fields)} WHERE id = :job_id"
                    ),
                    params,
                )
                conn.commit()
                return True
        except Exception as e:
            self.last_error = f"Update Scrub Job Error: {str(e)}"
            print(self.last_error)
            return False

    def get_scrub_job(self, job_id: int, username: str | None = None):
        """Fetches a single scrub job, optionally asserting ownership by username."""
        if not self.engine:
            return None
        try:
            with self.engine.connect() as conn:
                if username:
                    row = conn.execute(
                        text(
                            "SELECT * FROM scrub_jobs WHERE id = :job_id AND username = :username"
                        ),
                        {"job_id": job_id, "username": username},
                    ).mappings().first()
                else:
                    row = conn.execute(
                        text("SELECT * FROM scrub_jobs WHERE id = :job_id"),
                        {"job_id": job_id},
                    ).mappings().first()
                return dict(row) if row else None
        except Exception as e:
            print(f"Get Scrub Job Error: {e}")
            return None

    def list_scrub_jobs(self, username: str, limit: int = 20):
        """Lists recent scrub jobs for a given user."""
        if not self.engine:
            return []
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(
                    text(
                        """
                        SELECT * FROM scrub_jobs
                        WHERE username = :username
                        ORDER BY created_at DESC
                        LIMIT :limit
                        """
                    ),
                    {"username": username, "limit": limit},
                ).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"List Scrub Jobs Error: {e}")
            return []

    def create_admin_user(self, username, password):
        import bcrypt
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        pwd_hash = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("INSERT INTO user_details (username, password_hash) VALUES (:u, :p) ON CONFLICT (username) DO NOTHING"),
                    {"u": username, "p": pwd_hash}
                )
                conn.commit()
                return True
        except Exception as e:
            print("Create user error:", e)
            return False

    def verify_admin_user(self, username, password):
        import bcrypt
        try:
            with self.engine.connect() as conn:
                res = conn.execute(
                    text("SELECT password_hash FROM user_details WHERE username = :u"),
                    {"u": username}
                ).fetchone()
                if res:
                    pwd_hash = res[0].encode('utf-8')
                    pwd_bytes = password.encode('utf-8')
                    if bcrypt.checkpw(pwd_bytes, pwd_hash):
                        return True
                return False
        except Exception as e:
            print("Verify user error:", e)
            return False


    def log_scrub_history(self, stats: dict):
        """Creates an entry in a new table specific for scrub history log."""
        msisdn_list = stats.pop("msisdn_list", [])
        results_table = "NONE"
        if msisdn_list:
            success, table_name = self.save_verified_scrub_results(msisdn_list)
            if success:
                results_table = table_name

        stats["results_table"] = results_table

        create_query = text("""
            CREATE TABLE IF NOT EXISTS scrub_history_log (
                id SERIAL PRIMARY KEY,
                total_input INT,
                final_count INT,
                dnd_removed INT,
                sub_removed INT,
                unsub_removed INT,
                operator_removed INT,
                results_table VARCHAR(255),
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 1. Create the table if it's new
        try:
            with self.engine.connect() as conn1:
                conn1.execute(create_query)
                conn1.commit()
        except Exception:
            pass

        # Make sure the results_table column exists if table is old
        try:
            with self.engine.connect() as conn2:
                conn2.execute(text("ALTER TABLE scrub_history_log ADD COLUMN results_table VARCHAR(255)"))
                conn2.commit()
        except Exception:
            pass

        # 2. Insert the entry
        insert_query = text("""
            INSERT INTO scrub_history_log 
            (total_input, final_count, dnd_removed, sub_removed, unsub_removed, operator_removed, results_table)
            VALUES 
            (:total_input, :final_count, :dnd_removed, :sub_removed, :unsub_removed, :operator_removed, :results_table)
        """)
        try:
            with self.engine.connect() as conn3:
                conn3.execute(insert_query, stats)
                conn3.commit()
                return True, f"Scrub entry successfully logged. Results saved in table: {results_table}"
        except Exception as e:
            err_msg = f"Failed to log scrub entry: {str(e)}"
            print(f"ERROR: {err_msg}")
            return False, err_msg

    def get_scrub_history(self):
        """Fetches the last 50 scrub history entries."""
        try:
            # Add results_table safely just in case
            with self.engine.connect() as connection:
                try:
                    connection.execute(text("ALTER TABLE scrub_history_log ADD COLUMN results_table VARCHAR(255)"))
                except Exception:
                    pass
        except Exception:
            pass

        query = "SELECT * FROM scrub_history_log ORDER BY logged_at DESC LIMIT 50"
        return self.execute_query(query)

    def save_scheduling_details(self, details: dict):
        """Inserts scheduling details into the database."""

        query = text("""
            INSERT INTO obdscheduling_details (obd_name, flow_name, msc_ip, cli)
            VALUES (:obd_name, :flow_name, :msc_ip, :cli)
        """)
        try:
            with self.engine.connect() as connection:
                connection.execute(query, details)
                connection.commit()
                return True
        except Exception as e:
            self.last_error = f"Save Scheduling Error: {str(e)}"
            print(self.last_error)
            return False

    def save_campaign_targets_project(self, msisdns: list, project_name: str):
        """
        Saves MSISDNs into a single dynamically created table: obd_d1_{project_name}
        Internally batches inserts to prevent DB overload.
        """
        if not msisdns:
            return True, "No MSISDNs to save."
            
        import re
        # Sanitize project name to be a valid SQL identifier
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', project_name).lower()
        if not safe_name: safe_name = "default"
        
        table_name = f"obd_d1_{safe_name}"
        print(f"DEBUG: Saving {len(msisdns)} targets into table '{table_name}'")
        
        try:
            with self.engine.connect() as connection:
                # 1. Create the specific project table
                create_query = text(f"""
                    CREATE TABLE IF NOT EXISTS {table_name} (
                        id SERIAL PRIMARY KEY,
                        msisdn VARCHAR(20) NOT NULL,
                        scheduled BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                connection.execute(create_query)
                
                # 2. Insert the data in chunks
                chunk_size = 5000
                for start_idx in range(0, len(msisdns), chunk_size):
                    chunk = msisdns[start_idx:start_idx + chunk_size]
                    rows = [{"msisdn": m, "scheduled": True} for m in chunk]
                    insert_query = text(f"""
                        INSERT INTO {table_name} (msisdn, scheduled)
                        VALUES (:msisdn, :scheduled)
                    """)
                    connection.execute(insert_query, rows)
                
                connection.commit()
                return True, f"Successfully saved {len(msisdns)} targets into single table: {table_name}"
        except Exception as e:
            err_msg = f"Failed to save campaign targets: {str(e)}"
            print(f"ERROR: {err_msg}")
            return False, err_msg

    def save_verified_scrub_results(self, msisdns: list):
        """
        Saves verified MSISDNs into a unique timestamped table.
        Used automatically after each scrub.
        """
        if not msisdns:
            return True, "No MSISDNs to save."

        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"scrub_results_{timestamp}"
        
        # Use smaller chunks for execute_values to stay within query size limits
        chunk_size = 50000
        msisdn_chunks = [msisdns[i:i + chunk_size] for i in range(0, len(msisdns), chunk_size)]
        
        raw_conn = None
        try:
            raw_conn = self.engine.raw_connection()
            cursor = raw_conn.cursor()
            # 1. Create the specific scrub results table
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    id SERIAL PRIMARY KEY,
                    msisdn VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 2. Incredible fast chunked bulk insertion
            from psycopg2.extras import execute_values
            for chunk in msisdn_chunks:
                data = [(str(m),) for m in chunk]
                execute_values(
                    cursor,
                    f"INSERT INTO {table_name} (msisdn) VALUES %s",
                    data,
                    page_size=10000
                )
                raw_conn.commit()
            
            cursor.close()

            # Invalidate stats cache
            try:
                from .cache_engine import cache_engine
                cache_engine.delete("db_stats")
            except:
                pass
            
            return True, table_name
        except Exception as e:
            err_msg = f"Failed to auto-save scrub results: {str(e)}"
            print(f"ERROR: {err_msg}")
            if raw_conn:
                try:
                    raw_conn.rollback()
                except:
                    pass
            return False, err_msg
        finally:
            if raw_conn:
                try:
                    raw_conn.close()
                except:
                    pass


    def execute_query(self, query, params=None):
        """Executes a raw SQL select query and handles result mapping."""
        if not self.engine:
            return []
        
        try:
            with self.engine.connect() as connection:
                statement = text(query) if isinstance(query, str) else query
                result = connection.execute(statement, params or {})
                # Using .mappings() for robust dict conversion across SQL flavors
                return [dict(row) for row in result.mappings()]
        except Exception as e:
            print(f"Query Error: {e}")
            return []

    def _expand_msisdns(self, msisdns):
        """Expands a list of bare MSISDNs into multiple common formats for robust lookup.
        High-performance set-based expansion.
        """
        expanded = set()
        for m in msisdns:
            if not m: continue
            # Basic fast normalization for lookup
            m_str = str(m).strip()
            # 1. Bare (assume it's bare if it doesn't lead with 0/234)
            expanded.add(m_str)
            # 2. 0-prefixed (Local)
            if not m_str.startswith('0'):
                expanded.add(f"0{m_str}")
            # 3. 234-prefixed (International)
            if not m_str.startswith('234'):
                expanded.add(f"234{m_str}")
            # 4. Suffix (very robust for partial DB data)
            if len(m_str) > 8:
                expanded.add(m_str[-8:])
        return list(expanded)

    def _chunked_lookup(self, msisdns, query_template, extra_params=None):
        """Processes large MSISDN lists in parallel batches for extreme speed."""
        if not msisdns:
            return []
            
        from .cache_engine import cache_engine
        import concurrent.futures
        
        # 1. OPTIMIZATION: Small table fetch (Table-level caching)
        import re
        table_match = re.search(r'FROM\s+(\w+)', query_template, re.IGNORECASE)
        if table_match and self.engine:
            table_name = table_match.group(1)
            cache_key = f"table_full:{table_name}:{hash(str(extra_params))}"
            cached_data = cache_engine.get(cache_key)
            if cached_data is not None:
                return cached_data

            try:
                with self.engine.connect() as conn:
                    count = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
                    if count < 50000:
                        q_str = f"SELECT msisdn FROM {table_name}"
                        if extra_params and "service_id" in extra_params:
                            q_str += " WHERE service_id = :service_id AND status = 'ACTIVE'"
                        
                        all_res = conn.execute(text(q_str), extra_params or {})
                        res_list = [row[0] for row in all_res]
                        cache_engine.set(cache_key, res_list, expire=600)
                        return res_list
            except Exception as e:
                print(f"DEBUG: Optimization check failed: {e}")

        # 2. PARALLEL CHUNKED LOOKUP
        expanded = self._expand_msisdns(msisdns)
        results = []
        chunk_size = 30000 # Larger chunks = fewer calls
        chunks = [expanded[i:i + chunk_size] for i in range(0, len(expanded), chunk_size)]
        
        def process_chunk(chunk_list):
            try:
                with self.engine.connect() as connection:
                    params = {"msisdns": chunk_list}
                    if extra_params:
                        params.update(extra_params)
                    
                    query = text(query_template).bindparams(
                        bindparam("msisdns", expanding=True)
                    )
                    chunk_results = connection.execute(query, params).mappings()
                    return [row['msisdn'] for row in chunk_results if 'msisdn' in row]
            except Exception as e:
                print(f"Chunk Query Error on {table_name}: {e}")
                return []

        # Utilize ThreadPool to handle parallel network requests to Supabase
        max_workers = min(10, len(chunks)) if chunks else 1
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_chunk = {executor.submit(process_chunk, c): c for c in chunks}
            for future in concurrent.futures.as_completed(future_to_chunk):
                results.extend(future.result())
            
        return list(set(results)) # Deduplicate matches

    def check_dnd_bulk(self, msisdns):
        """Checks which given MSISDNs are in the DND list (Batch-Optimized)."""
        query = "SELECT msisdn FROM dnd_list WHERE msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query)

    def check_subscriptions_bulk(self, msisdns, service_id="PROMO"):
        """Checks which MSISDNs are already subscribed (Batch-Optimized)."""
        query = "SELECT msisdn FROM subscriptions WHERE service_id = :service_id AND status = 'ACTIVE' AND msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query, {"service_id": service_id})

    def check_unsubscriptions_bulk(self, msisdns):
        """Checks which MSISDNs have unsubscribed (Batch-Optimized)."""
        query = "SELECT msisdn FROM unsubscriptions WHERE msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query)

    def save_email_csv_data(self, uid, filename, msisdns):
        """Legacy method - redirects to new table method."""
        return self.save_email_csv_to_new_table(uid, filename, msisdns)

    def save_email_csv_to_new_table(self, uid, filename, msisdns):
        """
        Saves MSISDNs from an email CSV into a NEW timestamped table.
        Each scrub creates its own table: email_csv_YYYYMMDD_HHMMSS
        Uses psycopg2 execute_values for fast bulk insert.
        """
        if not msisdns:
            return True, "No MSISDNs to save."

        from datetime import datetime
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"email_csv_{timestamp}"
        
        # Use smaller chunks for execute_values to stay within query size limits
        chunk_size = 50000
        msisdn_chunks = [msisdns[i:i + chunk_size] for i in range(0, len(msisdns), chunk_size)]
        
        raw_conn = None
        try:
            raw_conn = self.engine.raw_connection()
            cursor = raw_conn.cursor()
            
            # 1. Check if UID already processed
            cursor.execute("SELECT 1 FROM email_sync_log WHERE email_uid = %s", (str(uid),))
            if cursor.fetchone():
                cursor.close()
                return False, f"Email UID {uid} already processed."
            
            # 2. Create NEW timestamped table
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    id SERIAL PRIMARY KEY,
                    msisdn VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 3. Fast chunked bulk insert
            from psycopg2.extras import execute_values
            print(f"DEBUG: Bulk inserting {len(msisdns)} rows into {table_name} in chunks...")
            for chunk in msisdn_chunks:
                data = [(str(m),) for m in chunk]
                execute_values(
                    cursor,
                    f"INSERT INTO {table_name} (msisdn) VALUES %s",
                    data,
                    page_size=10000
                )
                raw_conn.commit()
            
            # 4. Log the sync
            cursor.execute(
                "INSERT INTO email_sync_log (email_uid, filename) VALUES (%s, %s)",
                (str(uid), f"{filename} -> {table_name}")
            )
            raw_conn.commit()
            
            cursor.close()
            return True, table_name
        except Exception as e:
            err_msg = f"Email CSV Sync Error: {str(e)}"
            print(err_msg)
            if raw_conn:
                try:
                    raw_conn.rollback()
                except:
                    pass
            return False, err_msg
        finally:
            if raw_conn:
                try:
                    raw_conn.close()
                except:
                    pass
