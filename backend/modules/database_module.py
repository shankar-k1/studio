import os
import json
import uuid
from datetime import datetime
from sqlalchemy import create_engine, text, bindparam
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import bcrypt

load_dotenv()

class DatabaseModule:
    def __init__(self):
        self.db_type = os.getenv("DB_TYPE", "mysql") 
        self.init_error: str = ""
        self.last_error: str = ""
        
        # Build URL from individual env vars if DATABASE_URL is missing
        db_url = os.getenv("DATABASE_URL")
        
        if not db_url:
            user = os.getenv("DB_USER", "root" if self.db_type == "mysql" else "postgres")
            password = os.getenv("DB_PASS", "shan2001" if self.db_type == "mysql" else "")
            host = os.getenv("DB_HOST", "localhost")
            port = os.getenv("DB_PORT", "3306" if self.db_type == "mysql" else "5432")
            dbname = os.getenv("DB_NAME", "obd_promotions" if self.db_type == "mysql" else "postgres")
            
            if self.db_type == "mysql":
                db_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"
            else:
                db_url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"
        else:
            # Clean up the provided URL
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
            elif db_url.startswith("postgresql://"):
                db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            elif db_url.startswith("mysql://"):
                db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)
            
            # Remove prepare_threshold for Postgres as it causes errors with SQLAlchemy
            if "prepare_threshold" in db_url:
                import re
                db_url = re.sub(r'[&?]prepare_threshold=[^&]+', '', db_url)
                if db_url.endswith('?'):
                    db_url = db_url[:-1]

        self.url = db_url
        self.engine = None
        
        try:
            if "mysql" in self.url:
                self.engine = create_engine(
                    self.url, 
                    pool_pre_ping=True,
                    pool_recycle=300,
                    pool_timeout=30,
                    pool_size=10,
                    max_overflow=20,
                    connect_args={"charset": "utf8mb4"}
                )
            else:
                self.engine = create_engine(
                    self.url, 
                    pool_pre_ping=True,
                    pool_recycle=300,
                    pool_timeout=30,
                    pool_size=5,
                    max_overflow=10,
                    connect_args={"connect_timeout": 10}
                )
        except Exception as e:
            self.init_error = str(e)
            print(f"❌ DATABASE INITIALIZATION ERROR: {e}")
            
        if self.engine:
            try:
                # Test connection with a strict timeout to avoid hanging the app
                print(f"DEBUG: Testing DB connection to {self.engine.url.host}...")
                with self.engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print("DEBUG: DB Connection Successful.")
                self.db_name = self.engine.url.database
                self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
                self._initialize_tables()
            except Exception as e:
                self.init_error = f"Conn Test Failed: {str(e)}"
                print(f"❌ DATABASE CONNECTION ERROR: {e}")
                # We don't set engine to None here, we might want to retry later or show error in UI

    def _initialize_tables(self):
        """Creates the necessary tables if they don't exist (MySQL syntax)."""
        queries = [
            """
            CREATE TABLE IF NOT EXISTS obdscheduling_details (
                id INT AUTO_INCREMENT PRIMARY KEY,
                obd_name VARCHAR(255) NOT NULL,
                flow_name VARCHAR(255) NOT NULL,
                msc_ip VARCHAR(50) NOT NULL,
                cli VARCHAR(50) NOT NULL,
                service_id VARCHAR(255),
                jobname VARCHAR(255),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                start_time VARCHAR(50),
                end_time VARCHAR(50),
                priority VARCHAR(20) DEFAULT '1',
                status VARCHAR(50) DEFAULT 'Active',
                blackout_hours VARCHAR(50) DEFAULT '0',
                max_retry VARCHAR(20) DEFAULT '1',
                remaining_retry VARCHAR(20) DEFAULT '1',
                starcopy VARCHAR(20) DEFAULT '0',
                recorddedication VARCHAR(20) DEFAULT '1',
                server_ip VARCHAR(50),
                max_obd_count VARCHAR(50),
                daywise VARCHAR(50) DEFAULT '0',
                scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS dnd_list (
                id INT AUTO_INCREMENT PRIMARY KEY,
                msisdn VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                service_id VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS unsubscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS campaign_targets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS user_details (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "", # Handled by migration logic below
            """
            CREATE TABLE IF NOT EXISTS email_sync_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email_uid VARCHAR(255) UNIQUE NOT NULL,
                filename VARCHAR(255),
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS email_sourced_targets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                msisdn VARCHAR(20) NOT NULL,
                email_uid VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS scrub_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                operator VARCHAR(50),
                options_json TEXT,
                total_input BIGINT DEFAULT 0,
                final_count BIGINT DEFAULT 0,
                dnd_removed BIGINT DEFAULT 0,
                sub_removed BIGINT DEFAULT 0,
                unsub_removed BIGINT DEFAULT 0,
                operator_removed BIGINT DEFAULT 0,
                results_table VARCHAR(255),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS scrub_job_inputs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                job_id INT,
                msisdn VARCHAR(20) NOT NULL,
                FOREIGN KEY (job_id) REFERENCES scrub_jobs(id) ON DELETE CASCADE,
                INDEX idx_job_input_msisdn (msisdn),
                INDEX idx_job_input_job_id (job_id)
            )
            """,
            # SCP Flow Diagram Tables
            """
            CREATE TABLE IF NOT EXISTS flows (
              id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              uuid          VARCHAR(36)   NOT NULL UNIQUE,
              flow_name     VARCHAR(255)  NOT NULL,
              service_name  VARCHAR(255)  DEFAULT NULL,
              short_code    VARCHAR(50)   DEFAULT NULL,
              call_type     ENUM('IVR','OBD','UNKNOWN') DEFAULT 'IVR',
              default_lang  VARCHAR(10)   DEFAULT '_E',
              source        ENUM('xml_upload','builder','pdf_parse') NOT NULL DEFAULT 'xml_upload',
              filename      VARCHAR(512)  DEFAULT NULL,
              xml_content   LONGTEXT      DEFAULT NULL,
              node_count    SMALLINT      DEFAULT 0,
              edge_count    SMALLINT      DEFAULT 0,
              description   TEXT          DEFAULT NULL,
              created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
              updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS nodes (
              id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id       INT UNSIGNED NOT NULL,
              node_key      VARCHAR(50)  NOT NULL,
              node_type     VARCHAR(50)  NOT NULL,
              label         VARCHAR(255) NOT NULL,
              pos_x         FLOAT        DEFAULT 0,
              pos_y         FLOAT        DEFAULT 0,
              created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS node_params (
              id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              node_id       INT UNSIGNED NOT NULL,
              param_key     VARCHAR(100) NOT NULL,
              param_value   TEXT         DEFAULT NULL,
              FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS edges (
              id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id       INT UNSIGNED NOT NULL,
              edge_key      VARCHAR(50)  DEFAULT NULL,
              source_key    VARCHAR(50)  NOT NULL,
              target_key    VARCHAR(50)  NOT NULL,
              edge_type     ENUM('DTMF','DB','Normal')  DEFAULT 'Normal',
              label         VARCHAR(100) DEFAULT '',
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS prompt_files (
              id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id       INT UNSIGNED NOT NULL,
              node_id       INT UNSIGNED NOT NULL,
              node_label    VARCHAR(255) DEFAULT NULL,
              node_type     VARCHAR(50)  DEFAULT NULL,
              full_path     TEXT         DEFAULT NULL,
              filename      VARCHAR(512) DEFAULT NULL,
              timeout_sec   SMALLINT     DEFAULT 0,
              repeat_count  SMALLINT     DEFAULT 0,
              barge_in      TINYINT   DEFAULT 0,
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
              FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS explanations (
              id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id         INT UNSIGNED NOT NULL,
              section_title   VARCHAR(255) NOT NULL,
              section_body    TEXT         NOT NULL,
              section_order   TINYINT      DEFAULT 0,
              generated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS pdf_uploads (
              id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id         INT UNSIGNED DEFAULT NULL,
              original_name   VARCHAR(512) NOT NULL,
              file_size_bytes INT UNSIGNED DEFAULT 0,
              extracted_text  LONGTEXT     DEFAULT NULL,
              parse_status    ENUM('pending','success','failed') DEFAULT 'pending',
              parse_error     TEXT         DEFAULT NULL,
              uploaded_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE SET NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS audit_log (
              id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              flow_id     INT UNSIGNED DEFAULT NULL,
              action      VARCHAR(100) NOT NULL,
              detail      VARCHAR(512) DEFAULT NULL,
              ip_address  VARCHAR(45)  DEFAULT NULL,
              user_agent  VARCHAR(512) DEFAULT NULL,
              created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS app_settings (
              setting_key   VARCHAR(100) PRIMARY KEY,
              setting_value TEXT,
              updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS vocal_sync_history (
              id              INT AUTO_INCREMENT PRIMARY KEY,
              filename        VARCHAR(255),
              original_text   TEXT,
              translated_text TEXT,
              source_lang     VARCHAR(10),
              target_lang     VARCHAR(10),
              output_url      TEXT,
              metadata_json   TEXT,
              created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
                for query in queries:
                    try:
                        if query.strip():
                            connection.execute(text(query))
                    except Exception as qe:
                        if "Duplicate" not in str(qe) and "already exists" not in str(qe):
                            print(f"Migration Query Note: {qe}")
                connection.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
                connection.commit()

            # ROBUST COLUMN MIGRATIONS (MySQL Compatible)
            with self.engine.connect() as connection:
                def ensure_col(table, col, def_str):
                    try:
                        check_sql = f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}' AND COLUMN_NAME='{col}' AND TABLE_SCHEMA='{self.db_name}'"
                        res = connection.execute(text(check_sql)).mappings().first()
                        if not res:
                            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {def_str}"))
                            connection.commit()
                    except Exception as e: print(f"Col Migration failed ({table}.{col}): {e}")

                def ensure_idx(table, idx, col_def):
                    try:
                        check_sql = f"SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME='{table}' AND INDEX_NAME='{idx}' AND TABLE_SCHEMA='{self.db_name}'"
                        res = connection.execute(text(check_sql)).mappings().first()
                        if not res:
                            connection.execute(text(f"CREATE INDEX {idx} ON {table}({col_def})"))
                            connection.commit()
                    except Exception as e: print(f"Idx Migration failed ({table}.{idx}): {e}")

                # Add Essential Statistics Columns to scrub_jobs
                for col in ["dnd_removed", "sub_removed", "unsub_removed", "operator_removed"]:
                    ensure_col("scrub_jobs", col, "BIGINT DEFAULT 0")
                
                # Add Speed Optimization Columns (suffix8)
                for table in ["dnd_list", "subscriptions", "unsubscriptions", "scrub_job_inputs"]:
                    ensure_col(table, "suffix8", "VARCHAR(8) AS (RIGHT(msisdn, 8)) STORED")
                    ensure_idx(table, f"idx_{table}_suffix8", "suffix8")
                
                # Upgrade obdscheduling_details
                scheduling_cols = [
                    ('service_id', 'VARCHAR(255)'), ('jobname', 'VARCHAR(255)'),
                    ('start_date', 'VARCHAR(50)'), ('end_date', 'VARCHAR(50)'),
                    ('start_time', 'VARCHAR(50)'), ('end_time', 'VARCHAR(50)'),
                    ('priority', 'VARCHAR(20) DEFAULT "1"'), ('status', 'VARCHAR(50) DEFAULT "Active"'),
                    ('blackout_hours', 'VARCHAR(50) DEFAULT "0"'), ('max_retry', 'VARCHAR(20) DEFAULT "1"'),
                    ('remaining_retry', 'VARCHAR(20) DEFAULT "1"'), ('starcopy', 'VARCHAR(20) DEFAULT "0"'),
                    ('recorddedication', 'VARCHAR(20) DEFAULT "1"'), ('server_ip', 'VARCHAR(50)'),
                    ('max_obd_count', 'VARCHAR(50)'), ('daywise', 'VARCHAR(50) DEFAULT "0"')
                ]
                for col, ctype in scheduling_cols:
                    ensure_col("obdscheduling_details", col, ctype)
                
                # Global Productivity Indexes
                ensure_idx("dnd_list", "idx_dnd_msisdn", "msisdn")
                ensure_idx("subscriptions", "idx_subs_msisdn", "msisdn")
                ensure_idx("unsubscriptions", "idx_unsubs_msisdn", "msisdn")
                ensure_idx("campaign_targets", "idx_camp_msisdn", "msisdn")
                ensure_idx("scrub_job_inputs", "idx_job_input_job_id", "job_id")
                ensure_idx("scrub_job_inputs", "idx_job_input_msisdn", "msisdn")

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
        if not self.engine:
            return None
        from datetime import datetime
        import json
        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("""
                        INSERT INTO scrub_jobs (username, status, operator, options_json, total_input, created_at)
                        VALUES (:username, :status, :operator, :options_json, :total_input, :created_at)
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
                job_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                conn.commit()
                return job_id
        except Exception as e:
            self.last_error = f"Create Scrub Job Error: {str(e)}"
            print(self.last_error)
            return None

    def add_scrub_job_inputs(self, job_id: int, msisdns: list[str]):
        """Persists the raw MSISDN base for a job in a separate table (Fast Batch)."""
        if not self.engine or not msisdns:
            return False
            
        chunk_size = 50000 
        try:
            with self.engine.connect() as conn:
                for i in range(0, len(msisdns), chunk_size):
                    chunk = msisdns[i:i + chunk_size]
                    data = [{"jid": job_id, "m": str(m).strip()} for m in chunk if m]
                    if data:
                        conn.execute(
                            text("INSERT INTO scrub_job_inputs (job_id, msisdn) VALUES (:jid, :m)"),
                            data
                        )
                conn.commit()
                return True
        except Exception as e:
            print(f"Error inserting scrub base: {e}")
            return False

    def perform_job_scrub_sql(self, job_id: int, options: dict, operator_name: str | None = None):
        """Processes the entire scrubbing flow in pure SQL (Sub-Second)."""
        metrics = {"dnd": 0, "sub": 0, "unsub": 0, "operator": 0, "final": 0}
        if not self.engine: return metrics
        
        # OPERATOR SERIES MAP (Stripped 0 for suffix/prefix flexibility)
        ops_map = {
            "MTN": ["803", "806", "703", "706", "810", "813", "814", "816", "903", "906"],
            "Airtel": ["802", "808", "701", "708", "812", "902", "901", "907"],
            "Glo": ["805", "807", "705", "811", "815", "905"],
            "9mobile": ["809", "817", "818", "909"]
        }
        
        try:
            with self.engine.begin() as conn:
                # 1. OPERATOR FILTERING
                if options.get("operator") and operator_name in ops_map:
                    prefixes = ops_map[operator_name]
                    # Create a broad prefix filter (0803, 234803, 803)
                    conditions = []
                    for p in prefixes:
                        conditions.append(f"msisdn LIKE '0{p}%' OR msisdn LIKE '234{p}%' OR msisdn LIKE '{p}%'")
                    
                    sql = f"DELETE FROM scrub_job_inputs WHERE job_id = :jid AND NOT ({' OR '.join(conditions)})"
                    res = conn.execute(text(sql), {"jid": job_id})
                    metrics["operator"] = res.rowcount

                # 2. DND EXCLUSION (JOIN ON SUFFIX8)
                if options.get("dnd"):
                    sql = """DELETE FROM scrub_job_inputs WHERE job_id = :jid 
                             AND suffix8 IN (SELECT suffix8 FROM dnd_list)"""
                    res = conn.execute(text(sql), {"jid": job_id})
                    metrics["dnd"] = res.rowcount

                # 3. SUBSCRIPTIONS EXCLUSION
                if options.get("sub"):
                    sql = """DELETE FROM scrub_job_inputs WHERE job_id = :jid 
                             AND suffix8 IN (SELECT suffix8 FROM subscriptions WHERE status='ACTIVE')"""
                    res = conn.execute(text(sql), {"jid": job_id})
                    metrics["sub"] = res.rowcount
                
                # 4. UNSUBSCRIBED EXCLUSION
                if options.get("unsub"):
                    sql = """DELETE FROM scrub_job_inputs WHERE job_id = :jid 
                             AND suffix8 IN (SELECT suffix8 FROM unsubscriptions)"""
                    res = conn.execute(text(sql), {"jid": job_id})
                    metrics["unsub"] = res.rowcount
                    
                # 5. FETCH FINAL COUNT
                final_res = conn.execute(text("SELECT COUNT(*) FROM scrub_job_inputs WHERE job_id = :jid"), {"jid": job_id})
                metrics["final"] = final_res.scalar()
                
            return metrics
        except Exception as e:
            print(f"SQL Scrub Engine Failure: {e}")
            return metrics

    def load_scrub_job_inputs(self, job_id: int, chunk_size: int = 100000):
        """Generator yielding MSISDN chunks for a job (MySQL syntax)."""
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
                        LIMIT :limit OFFSET :offset
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
        dnd_removed: int | None = None,
        sub_removed: int | None = None,
        unsub_removed: int | None = None,
        operator_removed: int | None = None,
    ):
        """Updates status and optional metadata of a scrub job."""
        if not self.engine:
            return False
        from datetime import datetime
        fields = ["status = :status"]
        params = {"job_id": job_id, "status": status}
        if final_count is not None:
            fields.append("final_count = :final_count")
            params["final_count"] = int(final_count)
        if dnd_removed is not None:
            fields.append("dnd_removed = :dnd_removed")
            params["dnd_removed"] = int(dnd_removed)
        if sub_removed is not None:
            fields.append("sub_removed = :sub_removed")
            params["sub_removed"] = int(sub_removed)
        if unsub_removed is not None:
            fields.append("unsub_removed = :unsub_removed")
            params["unsub_removed"] = int(unsub_removed)
        if operator_removed is not None:
            fields.append("operator_removed = :operator_removed")
            params["operator_removed"] = int(operator_removed)
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
        # import bcrypt (moved to top-level)
        if not self.engine:
            return False
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        pwd_hash = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("INSERT IGNORE INTO user_details (username, password_hash) VALUES (:u, :p)"),
                    {"u": username, "p": pwd_hash}
                )
                conn.commit()
                return True
        except Exception as e:
            print("Create user error:", e)
            return False

    def verify_admin_user(self, username, password):
        # import bcrypt (moved to top-level)
        if not self.engine:
            return False
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
        if not self.engine:
            return False, "Database engine not initialized"
        msisdn_list = stats.pop("msisdn_list", [])
        results_table = stats.get("results_table", "NONE")
        if msisdn_list:
            success, table_name = self.save_verified_scrub_results(msisdn_list)
            if success:
                results_table = table_name

        stats["results_table"] = results_table

        create_query = text("""
            CREATE TABLE IF NOT EXISTS scrub_history_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
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
        if not self.engine:
            return []
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
        if not self.engine:
            return False

        # Build query dynamically based on keys in details
        cols = []
        placeholders = []
        for key in details.keys():
            cols.append(key)
            placeholders.append(f":{key}")
        
        col_str = ", ".join(cols)
        placeholder_str = ", ".join(placeholders)
        
        query = text(f"INSERT INTO obdscheduling_details ({col_str}) VALUES ({placeholder_str})")
        
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
        if not self.engine:
            return False, "Database engine not initialized"
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
                        id INT AUTO_INCREMENT PRIMARY KEY,
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
        """Legacy - use job-based version for speed."""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"scrub_results_{timestamp}"
        try:
            with self.engine.connect() as conn:
                conn.execute(text(f"CREATE TABLE {table_name} (msisdn VARCHAR(20))"))
                if msisdns:
                    # Using multi-row insert for decent speed
                    chunk_size = 10000
                    for i in range(0, len(msisdns), chunk_size):
                        conn.execute(text(f"INSERT INTO {table_name} (msisdn) VALUES (:m)"), [{"m": str(m)} for m in msisdns[i:i+chunk_size]])
                conn.commit()
            return True, table_name
        except Exception as e:
            return False, str(e)

    def save_verified_scrub_job_results(self, job_id: int):
        """Highly optimized server-side copy from job inputs to a unique result table."""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"scrub_results_{job_id}_{timestamp}"
        try:
            with self.engine.begin() as conn:
                conn.execute(text(f"CREATE TABLE {table_name} (msisdn VARCHAR(20))"))
                conn.execute(text(f"INSERT INTO {table_name} (msisdn) SELECT msisdn FROM scrub_job_inputs WHERE job_id = :jid"), {"jid": job_id})
            return True, table_name
        except Exception as e:
            print(f"Server-Side Copy Failed: {e}")
            return False, str(e)


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
        if not self.engine:
            return []
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
        """Processes large MSISDN lists in parallel batches or via Temporary Table Joins for extreme speed."""
        if not self.engine:
            return []
        if not msisdns:
            return []
            
        from .cache_engine import cache_engine
        import concurrent.futures
        import uuid
        
        # 1. OPTIMIZATION: Small table fetch (Table-level caching)
        import re
        table_match = re.search(r'FROM\s+(\w+)', query_template, re.IGNORECASE)
        table_name = table_match.group(1) if table_match else "unknown"
        
        if table_match and self.engine:
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

        # 2. MEGA-SPEED OPTIMIZATION: Temporary Table Join for large lists (>15k)
        if len(msisdns) > 15000:
            tmp_table = f"tmp_lookup_{uuid.uuid4().hex[:8]}"
            try:
                expanded = self._expand_msisdns(msisdns)
                with self.engine.connect() as conn:
                    # Create indexed temporary table
                    conn.execute(text(f"CREATE TEMPORARY TABLE {tmp_table} (msisdn VARCHAR(20) PRIMARY KEY)"))
                    
                    # Batch insert into temp table (Fast)
                    insert_query = text(f"INSERT IGNORE INTO {tmp_table} (msisdn) VALUES (:m)")
                    batch_size = 20000
                    for i in range(0, len(expanded), batch_size):
                        chunk = [{"m": m} for m in expanded[i:i+batch_size]]
                        conn.execute(insert_query, chunk)
                    
                    # Execute JOIN query (Instant with indexes)
                    final_sql = f"SELECT {table_name}.msisdn {query_template[query_template.upper().find('FROM'):]}"
                    final_sql = final_sql.replace("WHERE msisdn IN :msisdns", "")
                    final_sql = final_sql.replace("msisdn IN :msisdns", "1=1")
                    
                    # Append the join logic
                    if "WHERE" in final_sql.upper():
                        final_sql += f" AND msisdn IN (SELECT msisdn FROM {tmp_table})"
                    else:
                        final_sql += f" WHERE msisdn IN (SELECT msisdn FROM {tmp_table})"
                        
                    res = conn.execute(text(final_sql), extra_params or {})
                    res_list = [row[0] for row in res]
                    
                    conn.execute(text(f"DROP TEMPORARY TABLE IF EXISTS {tmp_table}"))
                    conn.commit()
                    return list(set(res_list))
            except Exception as e:
                print(f"DEBUG: Temp table optimization failed, falling back: {e}")

        # 3. FALLBACK: PARALLEL CHUNKED LOOKUP
        expanded = self._expand_msisdns(msisdns)
        results = []
        chunk_size = 30000 
        chunks = [expanded[i:i + chunk_size] for i in range(0, len(expanded), chunk_size)]
        
        def process_chunk(chunk_list):
            try:
                with self.engine.connect() as connection:
                    params = {"msisdns": chunk_list}
                    if extra_params: params.update(extra_params)
                    query = text(query_template).bindparams(bindparam("msisdns", expanding=True))
                    chunk_results = connection.execute(query, params).mappings()
                    return [row['msisdn'] for row in chunk_results if 'msisdn' in row]
            except Exception as e:
                print(f"Chunk Query Error: {e}")
                return []

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(chunks) or 1)) as executor:
            for res_list in executor.map(process_chunk, chunks):
                results.extend(res_list)
                
        return list(set(results))

    def check_dnd_bulk(self, msisdns):
        """Checks which given MSISDNs are in the DND list (Batch-Optimized)."""
        if not self.engine:
            return []
        query = "SELECT msisdn FROM dnd_list WHERE msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query)

    def check_subscriptions_bulk(self, msisdns, service_id="PROMO"):
        """Checks which MSISDNs are already subscribed (Batch-Optimized)."""
        if not self.engine:
            return []
        query = "SELECT msisdn FROM subscriptions WHERE service_id = :service_id AND status = 'ACTIVE' AND msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query, {"service_id": service_id})

    def check_unsubscriptions_bulk(self, msisdns):
        """Checks which MSISDNs have unsubscribed (Batch-Optimized)."""
        if not self.engine:
            return []
        query = "SELECT msisdn FROM unsubscriptions WHERE msisdn IN :msisdns"
        return self._chunked_lookup(msisdns, query)

    def save_email_csv_data(self, uid, filename, msisdns):
        """Legacy method - redirects to new table method."""
        if not self.engine:
            return False, "Database engine not initialized"
        return self.save_email_csv_to_new_table(uid, filename, msisdns)

    def save_email_csv_to_new_table(self, uid, filename, msisdns):
        """
        Saves MSISDNs from an email CSV into a NEW timestamped table (MySQL).
        """
        if not self.engine:
            return False, "Database engine not initialized"
        if not msisdns:
            return True, "No MSISDNs to save."

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"email_csv_{timestamp}"
        
        try:
            with self.engine.connect() as conn:
                # 1. Check if UID already processed
                existing = conn.execute(text("SELECT 1 FROM email_sync_log WHERE email_uid = :u"), {"u": str(uid)}).fetchone()
                if existing:
                    return False, f"Email UID {uid} already processed."
                
                # 2. Create table
                conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS {table_name} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        msisdn VARCHAR(20) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                
                # 3. Bulk insert
                chunk_size = 5000
                for i in range(0, len(msisdns), chunk_size):
                    chunk = msisdns[i:i + chunk_size]
                    data = [{"msisdn": str(m)} for m in chunk]
                    conn.execute(text(f"INSERT INTO {table_name} (msisdn) VALUES (:msisdn)"), data)
                
                # 4. Log sync
                conn.execute(text("INSERT INTO email_sync_log (email_uid, filename) VALUES (:u, :f)"),
                           {"u": str(uid), "f": f"{filename} -> {table_name}"})
                conn.commit()
            return True, table_name
        except Exception as e:
            return False, str(e)

    # --- SCP FLOW MANAGEMENT ---

    def save_flow(self, flow_data: dict):
        """Saves a complete flow (flows, nodes, edges, params, prompts) to MySQL."""
        if not self.engine:
            return False, "Database engine not initialized"
        import uuid
        flow_uuid = flow_data.get("uuid") or str(uuid.uuid4())
        flow_name = flow_data.get("flowName", "Unnamed Flow")
        nodes = flow_data.get("nodes", [])
        edges = flow_data.get("edges", [])
        
        try:
            with self.engine.connect() as conn:
                # 1. Flow table
                existing = conn.execute(text("SELECT id FROM flows WHERE uuid = :u"), {"u": flow_uuid}).fetchone()
                if existing:
                    flow_id = existing[0]
                    conn.execute(text("""
                        UPDATE flows SET flow_name=:n, service_name=:sn, short_code=:sc, call_type=:ct,
                        default_lang=:dl, source=:src, filename=:fn, xml_content=:xml, 
                        node_count=:nc, edge_count=:ec, description=:desc, updated_at=NOW()
                        WHERE id=:id
                    """), {
                        "n": flow_name, "sn": flow_data.get("serviceName"), "sc": flow_data.get("shortCode"),
                        "ct": flow_data.get("callType", "IVR"), "dl": flow_data.get("defaultLang", "_E"),
                        "src": flow_data.get("source", "builder"), "fn": flow_data.get("filename"),
                        "xml": flow_data.get("xmlContent"), "nc": len(nodes), "ec": len(edges),
                        "desc": flow_data.get("description"), "id": flow_id
                    })
                else:
                    conn.execute(text("""
                        INSERT INTO flows (uuid, flow_name, service_name, short_code, call_type, default_lang,
                                         source, filename, xml_content, node_count, edge_count, description)
                        VALUES (:u, :n, :sn, :sc, :ct, :dl, :src, :fn, :xml, :nc, :ec, :desc)
                    """), {
                        "u": flow_uuid, "n": flow_name, "sn": flow_data.get("serviceName"), 
                        "sc": flow_data.get("shortCode"), "ct": flow_data.get("callType", "IVR"), 
                        "dl": flow_data.get("defaultLang", "_E"), "src": flow_data.get("source", "builder"), 
                        "fn": flow_data.get("filename"), "xml": flow_data.get("xmlContent"), 
                        "nc": len(nodes), "ec": len(edges), "desc": flow_data.get("description")
                    })
                    flow_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                
                # 2. Cleanup
                conn.execute(text("DELETE FROM nodes WHERE flow_id = :id"), {"id": flow_id})
                conn.execute(text("DELETE FROM edges WHERE flow_id = :id"), {"id": flow_id})

                # 3. Nodes
                node_map = {}
                for node in nodes:
                    conn.execute(text("""
                        INSERT INTO nodes (flow_id, node_key, node_type, label, pos_x, pos_y)
                        VALUES (:fid, :key, :typ, :lbl, :x, :y)
                    """), {
                        "fid": flow_id, "key": node.get("id"), "typ": node.get("type"),
                        "lbl": node.get("label", ""), "x": node.get("x", 0), "y": node.get("y", 0)
                    })
                    db_node_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                    node_map[node.get("id")] = db_node_id
                    
                    params = node.get("params", {})
                    for pk, pv in params.items():
                        if pv:
                            conn.execute(text("INSERT INTO node_params (node_id, param_key, param_value) VALUES (:nid, :k, :v)"),
                                       {"nid": db_node_id, "k": pk, "v": str(pv)})
                
                # 4. Edges
                for edge in edges:
                    conn.execute(text("""
                        INSERT INTO edges (flow_id, edge_key, source_key, target_key, edge_type, label)
                        VALUES (:fid, :ek, :sk, :tk, :et, :l)
                    """), {
                        "fid": flow_id, "ek": edge.get("id"), "sk": edge.get("source"),
                        "tk": edge.get("target"), "et": edge.get("type", "Normal"), "l": edge.get("label", "")
                    })

                # 5. Extract and Save Prompts
                conn.execute(text("DELETE FROM prompt_files WHERE flow_id = :id"), {"id": flow_id})
                for node in nodes:
                    params = node.get("params", {})
                    prompt_path = params.get("promptfile") or params.get("contentlist")
                    if prompt_path and prompt_path != '1' and node.get("type") in ['Navigation', 'Play']:
                        import re
                        # Basic filename extraction
                        clean_path = re.sub(r'^\d+-', '', prompt_path)
                        filename = clean_path.split('/')[-1] if '/' in clean_path else clean_path
                        
                        db_node_id = node_map.get(node.get("id"))
                        if db_node_id:
                            conn.execute(text("""
                                INSERT INTO prompt_files (flow_id, node_id, node_label, node_type, full_path, filename, timeout_sec, repeat_count, barge_in)
                                VALUES (:fid, :nid, :nl, :nt, :fp, :fn, :ts, :rc, :bi)
                            """), {
                                "fid": flow_id, "nid": db_node_id,
                                "nl": node.get("label"), "nt": node.get("type"),
                                "fp": prompt_path, "fn": filename,
                                "ts": int(params.get("timeout") or 0),
                                "rc": int(params.get("repeatcount") or 0),
                                "bi": 1 if params.get("bargein") == "true" else 0
                            })
                
                # 6. Audit Log
                conn.execute(text("""
                    INSERT INTO audit_log (flow_id, action, detail, ip_address, user_agent)
                    VALUES (:fid, :act, :det, :ip, :ua)
                """), {
                    "fid": flow_id, "act": "save_flow", "det": flow_name,
                    "ip": None, "ua": "Backend-Agent"
                })

                conn.commit()
                return True, flow_uuid
        except Exception as e:
            return False, str(e)

    def get_flows(self):
        return self.execute_query("SELECT * FROM flows ORDER BY updated_at DESC")

    def get_flow(self, flow_uuid: str):
        try:
            with self.engine.connect() as conn:
                flow = conn.execute(text("SELECT * FROM flows WHERE uuid = :u"), {"u": flow_uuid}).mappings().first()
                if not flow: return None
                flow = dict(flow)
                nodes = conn.execute(text("SELECT * FROM nodes WHERE flow_id = :fid"), {"fid": flow['id']}).mappings().all()
                nodes = [dict(n) for n in nodes]
                flow_dict = dict(flow)
                fid = flow_dict["id"]
                
                # Fetch nodes
                nodes = conn.execute(text("SELECT * FROM nodes WHERE flow_id = :fid"), {"fid": fid}).mappings().all()
                flow_dict["nodes"] = [dict(n) for n in nodes]
                
                # Fetch edges
                edges = conn.execute(text("SELECT * FROM edges WHERE flow_id = :fid"), {"fid": fid}).mappings().all()
                flow_dict["edges"] = [dict(e) for e in edges]
                
                # Fetch explanations
                expl = conn.execute(text("SELECT * FROM explanations WHERE flow_id = :fid ORDER BY section_order"), {"fid": fid}).mappings().all()
                flow_dict["explanation"] = [dict(s) for s in expl]
                
                return flow_dict
        except Exception as e:
            print(f"Error fetching flow: {e}")
            return None

    def delete_flow(self, flow_uuid: str):
        if not self.engine: return False
        try:
            with self.engine.connect() as conn:
                conn.execute(text("DELETE FROM flows WHERE uuid = :u"), {"u": flow_uuid})
                conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting flow: {e}")
            return False

    def save_explanation(self, flow_uuid: str, sections: list):
        if not self.engine: return False
        try:
            with self.engine.connect() as conn:
                # Get flow id
                fid = conn.execute(text("SELECT id FROM flows WHERE uuid = :u"), {"u": flow_uuid}).scalar()
                if not fid: return False
                
                # Clear old explanations
                conn.execute(text("DELETE FROM explanations WHERE flow_id = :fid"), {"fid": fid})
                
                # Insert new ones
                for s in sections:
                    conn.execute(text("""
                        INSERT INTO explanations (flow_id, section_title, section_body, section_order)
                        VALUES (:fid, :t, :b, :o)
                    """), {
                        "fid": fid,
                        "t": s.get("title", ""),
                        "b": s.get("body", ""),
                        "o": s.get("order", 0)
                    })
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving explanation: {e}")
            return False

    def get_explanation(self, flow_uuid: str):
        if not self.engine: return []
        try:
            with self.engine.connect() as conn:
                fid = conn.execute(text("SELECT id FROM flows WHERE uuid = :u"), {"u": flow_uuid}).scalar()
                if not fid: return []
                expl = conn.execute(text("SELECT * FROM explanations WHERE flow_id = :fid ORDER BY section_order"), {"fid": fid}).mappings().all()
                return [dict(s) for s in expl]
        except Exception as e:
            print(f"Error fetching explanation: {e}")
            return []


    def flush_scrub_queue(self):
        """Forcefully clears all pending scrub job inputs and resets 'processing' jobs."""
        if not self.engine: return False
        try:
            with self.engine.connect() as conn:
                # 1. Clear input buffer
                conn.execute(text("DELETE FROM scrub_job_inputs"))
                # 2. Mark hanging jobs as cleared/failed
                conn.execute(text("UPDATE scrub_jobs SET status='cleared' WHERE status='processing'"))
                conn.commit()
                return True
        except Exception as e:
            print(f"Flush Error: {e}")
            return False

    def search_flows(self, query: str):
        if not self.engine:
            return []
        try:
            q = f"%{query}%"
            with self.engine.connect() as conn:
                rows = conn.execute(text("""
                    SELECT id, uuid, flow_name, service_name, short_code, source, node_count, edge_count, created_at
                    FROM flows WHERE flow_name LIKE :q OR service_name LIKE :q OR short_code LIKE :q
                    ORDER BY updated_at DESC LIMIT 50
                """), {"q": q}).mappings().all()
                return [dict(r) for r in rows]
        except: return []

    def get_flow_prompts(self, flow_uuid: str):
        if not self.engine:
            return []
        try:
            with self.engine.connect() as conn:
                flow = conn.execute(text("SELECT id FROM flows WHERE uuid = :u"), {"u": flow_uuid}).fetchone()
                if not flow: return []
                rows = conn.execute(text("SELECT * FROM prompt_files WHERE flow_id = :fid ORDER BY node_label"), {"fid": flow[0]}).mappings().all()
                return [dict(r) for r in rows]
        except: return []

    def get_all_prompts(self):
        if not self.engine:
            return []
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(text("SELECT * FROM prompt_files ORDER BY filename LIMIT 500")).mappings().all()
                return [dict(r) for r in rows]
        except: return []


    def get_db_stats(self):
        """Returns a summary of database counts for the SCP dashboard."""
        if not self.engine:
            return {}
        try:
            with self.engine.connect() as conn:
                flows = conn.execute(text("SELECT COUNT(*) FROM flows")).scalar() or 0
                nodes = conn.execute(text("SELECT COUNT(*) FROM nodes")).scalar() or 0
                edges = conn.execute(text("SELECT COUNT(*) FROM edges")).scalar() or 0
                prompts = conn.execute(text("SELECT COUNT(DISTINCT filename) FROM prompt_files")).scalar() or 0
                # Explanations check (assuming there is an 'explanations' or similar field/table)
                explanations = conn.execute(text("SELECT COUNT(*) FROM audit_log WHERE action = 'save_explanation'")).scalar() or 0
                
                return {
                    "total_flows": flows,
                    "total_nodes": nodes,
                    "total_edges": edges,
                    "total_prompts": prompts,
                    "audit_logs": explanations
                }
        except Exception:
            return {}

    def get_setting(self, key: str, default=None):
        """Retrieves a setting value from the app_settings table."""
        if not self.engine:
            return default
        try:
            with self.engine.connect() as conn:
                res = conn.execute(text("SELECT setting_value FROM app_settings WHERE setting_key = :k"), {"k": key}).fetchone()
                return res[0] if res else default
        except Exception as e:
            print(f"Get setting error: {e}")
            return default

    def update_setting(self, key: str, value: str):
        """Updates or inserts a setting value."""
        if not self.engine:
            return False
        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("INSERT INTO app_settings (setting_key, setting_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE setting_value = :v"),
                    {"k": key, "v": value}
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"Update setting error: {e}")
            return False

    def add_vocal_sync_history(self, filename: str, original_text: str, translated_text: str, source_lang: str, target_lang: str, output_url: str, metadata_json: str = None):
        if not self.engine: return
        with self.engine.connect() as conn:
            query = text("""
                INSERT INTO vocal_sync_history (filename, original_text, translated_text, source_lang, target_lang, output_url, metadata_json)
                VALUES (:f, :ot, :tt, :sl, :tl, :ou, :mj)
            """)
            conn.execute(query, {
                "f": filename, "ot": original_text, "tt": translated_text,
                "sl": source_lang, "tl": target_lang, "ou": output_url, "mj": metadata_json or "{}"
            })
            conn.commit()

    def get_vocal_sync_history(self, limit: int = 50):
        if not self.engine: return []
        with self.engine.connect() as conn:
            query = text("SELECT * FROM vocal_sync_history ORDER BY created_at DESC LIMIT :l")
            result = conn.execute(query, {"l": limit})
            return [dict(row._mapping) for row in result]
