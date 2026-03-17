import pandas as pd
from sqlalchemy import text, bindparam
from .database_module import DatabaseModule
from .load_distributor import load_distributor
import asyncio
from functools import partial

# --- PARALLEL WORKERS MUST BE TOP-LEVEL FOR PICKLE (LOAD DISTRIBUTOR) ---
def _normalize_batch(chunk):
    """Worker for high-speed normalization."""
    results = []
    for msisdn in chunk:
        if not msisdn: 
            results.append((msisdn, ""))
            continue
        m = str(msisdn).strip().replace(" ", "").replace("-", "").replace("+", "")
        if m.startswith("234"): m = m[3:]
        if m.startswith("0"): m = m[1:]
        results.append((msisdn, m))
    return results

def _filter_operator_batch(chunk, allowed_prefixes):
    """Worker for operator prefix filtering."""
    return [m for m, norm in chunk if any(norm.startswith(p) for p in allowed_prefixes)]

def _filter_exclusions_batch(chunk, exclude_suffixes):
    """Worker for exclusion list filtering."""
    return [m for m, norm in chunk if (norm[-8:] if len(norm) >= 8 else norm) not in exclude_suffixes]

class ScrubbingEngine:
    def __init__(self):
        self.db = DatabaseModule()
        self.operator_series = {
            "MTN": ["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906"],
            "Airtel": ["0802", "0808", "0701", "0708", "0812", "0902", "0901", "0907"],
            "Glo": ["0805", "0807", "0705", "0811", "0815", "0905"],
            "9mobile": ["0809", "0817", "0818", "0909", "0809"]
        }
        self.subscription_data = {} # MSISDN: Status

    def normalize_msisdn(self, msisdn):
        """Standardizes MSISDN by removing common prefixes for consistent matching."""
        if not msisdn: return ""
        m = str(msisdn).strip().replace(" ", "").replace("-", "").replace("+", "")
        # Robust stripping of Nigerian country code
        if m.startswith("234"):
            m = m[3:]
        # Strip leading zero if it exists (very common in local formats)
        if m.startswith("0"):
            m = m[1:]
        return m

    def scrub_dnd(self, msisdns):
        """Removes numbers present in the DND list (via Optimized Batch SQL)."""
        if not msisdns:
            return [], 0
            
        initial_count = len(msisdns)
        # Get all relevant matches from DB
        raw_matches = self.db.check_dnd_bulk(msisdns)
        # Build bad suffix set (last 8 digits) for robust mapping
        bad_suffixes = {str(m).strip()[-8:] for m in raw_matches if len(str(m).strip()) >= 8}
        
        # Filter: check if normalized msisdn suffix is in bad set
        cleaned = [m for m in msisdns if self.normalize_msisdn(m)[-8:] not in bad_suffixes]
        return cleaned, initial_count - len(cleaned)

    def scrub_by_operator(self, msisdns, operator_name):
        """Filters numbers that belong to a specific operator series (Prefix-Robust)."""
        if operator_name not in self.operator_series:
            return msisdns, 0
        
        # Operators prefixes are usually defined with '0' (0803, etc)
        # We strip the '0' for universal matching against normalized numbers
        allowed_prefixes = [p[1:] if p.startswith("0") else p for p in self.operator_series[operator_name]]
        initial_count = len(msisdns)
        
        # Filter: normalize the msisdn first to remove '234' or '0' prefixes, then check startswith
        cleaned = [m for m in msisdns if any(self.normalize_msisdn(m).startswith(p) for p in allowed_prefixes)]
        return cleaned, initial_count - len(cleaned)

    def scrub_subscriptions(self, msisdns, service_id="PROMO"):
        """Filters out MSISDNs that are already subscribed (Optimized Bulk)."""
        if not msisdns:
            return [], 0
            
        initial_count = len(msisdns)
        raw_matches = self.db.check_subscriptions_bulk(msisdns, service_id)
        bad_suffixes = {str(m).strip()[-8:] for m in raw_matches if len(str(m).strip()) >= 8}
        
        cleaned = [m for m in msisdns if self.normalize_msisdn(m)[-8:] not in bad_suffixes]
        return cleaned, initial_count - len(cleaned)

    def scrub_unsubscribed(self, msisdns):
        """Filters out MSISDNs who have unsubscribed recently (Multi-Format)."""
        if not msisdns:
            return [], 0
            
        initial_count = len(msisdns)
        raw_matches = self.db.check_unsubscriptions_bulk(msisdns)
        bad_suffixes = {str(m).strip()[-8:] for m in raw_matches if len(str(m).strip()) >= 8}
        
        cleaned = [m for m in msisdns if self.normalize_msisdn(m)[-8:] not in bad_suffixes]
        return cleaned, initial_count - len(cleaned)

    async def perform_full_scrub(self, msisdns, target_operator=None, options=None):
        """
        Executes the full scrubbing pipeline with massive parallelism.
        """
        options = options or {"dnd": True, "sub": True, "unsub": True, "operator": True}
        initial_count = len(msisdns)
        print(f"DEBUG: Starting Optimized Parallel Scrub. Count: {initial_count}")
        
        report = {
            "initial_count": initial_count,
            "dnd_removed": 0, "operator_removed": 0, "sub_removed": 0, "unsub_removed": 0,
            "stages": []
        }
        report["stages"].append({"stage": "Total Base", "count": initial_count, "removed": 0})

        # 1. Parallel Normalization (Prepare normalized versions for all checks)
        # Use LoadDistributor for high-speed normalization
        normalized_data = await load_distributor.distribute_task(
            _normalize_batch,
            msisdns,
            chunk_size=50000
        )
        # m_map: {normalized_8: original_m}
        # Actually, multiple msisdns could have same suffix, but we just need a lookup set
        
        # 2. Parallel Database Checks
        tasks = []
        task_names = []
        
        if options.get("dnd"):
            tasks.append(asyncio.to_thread(self.db.check_dnd_bulk, msisdns))
            task_names.append("dnd")
        
        if options.get("sub"):
            tasks.append(asyncio.to_thread(self.db.check_subscriptions_bulk, msisdns))
            task_names.append("sub")
            
        if options.get("unsub"):
            tasks.append(asyncio.to_thread(self.db.check_unsubscriptions_bulk, msisdns))
            task_names.append("unsub")

        # Execute DB checks concurrently
        db_results = await asyncio.gather(*tasks) if tasks else []
        results_map = dict(zip(task_names, db_results))
        
        # 3. Build Global Exclusion Suffix Set
        exclude_suffixes = set()
        for res_list in db_results:
            for m in res_list:
                m_str = str(m).strip()
                if len(m_str) >= 8:
                    exclude_suffixes.add(m_str[-8:])

        # 4. Operator Filtering (Sequential but fast)
        current_base = msisdns
        if options.get("operator") and target_operator:
            allowed_prefixes = [p[1:] if p.startswith("0") else p for p in self.operator_series.get(target_operator, [])]
            
            # Parallelize the prefix check across cores
            current_base_with_norm = await load_distributor.distribute_task(
                partial(_filter_operator_batch, allowed_prefixes=allowed_prefixes), 
                normalized_data
            )
            report["operator_removed"] = initial_count - len(current_base_with_norm)
            report["stages"].append({"stage": f"After {target_operator} Filter", "count": len(current_base_with_norm), "removed": report["operator_removed"]})
        else:
            current_base_with_norm = normalized_data

        # 5. Final Exclusion Merge (Remove DND/Sub/Unsub)
        final_base = await load_distributor.distribute_task(
            partial(_filter_exclusions_batch, exclude_suffixes=exclude_suffixes), 
            current_base_with_norm
        )
        
        # Calculate individual removals for report (approximation since they were parallel)
        report["dnd_removed"] = len([m for m in results_map.get("dnd", [])])
        report["sub_removed"] = len([m for m in results_map.get("sub", [])])
        report["unsub_removed"] = len([m for m in results_map.get("unsub", [])])
        
        report["stages"].append({"stage": "Final Scrubbed Base", "count": len(final_base), "removed": initial_count - len(final_base)})
        
        print(f"DEBUG: Scrub complete in parallel. Final count: {len(final_base)}")
        return final_base, report
