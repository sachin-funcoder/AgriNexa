"""Local JSON-backed service for Community Posts, Comments, Grievance Reports, and Moderation."""

import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from app.schemas.community import (
    PostCategory,
    ReportCategory,
    ReportStatus,
    CommentCreate,
    CommentResponse,
    PostCreate,
    PostResponse,
    ReportCreate,
    ReportResponse,
    ModerationQueueResponse,
)
from app.services.mandi_service import MandiService

logger = logging.getLogger("agrinexa.community")


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CommunityService:
    """
    Manages farmer community posts, comments, reports, and moderation workflows.
    Persists data locally in JSON format with atomic replacement writes.
    """

    def __init__(self, data_dir: Optional[Path] = None, mandi_service: Optional[MandiService] = None):
        if data_dir is None:
            base_dir = Path(__file__).resolve().parent.parent / "data" / "community"
        else:
            base_dir = Path(data_dir)

        self.data_dir = base_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.posts_file = self.data_dir / "posts.json"
        self.reports_file = self.data_dir / "reports.json"

        self.mandi_service = mandi_service or MandiService()

        # Initialize and seed if empty
        self._initialize_storage()

    # -------------------------------------------------------------------------
    # Safe Atomic JSON Storage
    # -------------------------------------------------------------------------

    def _safe_write_json(self, file_path: Path, data: Any) -> None:
        """Writes data to a temporary file in the same directory, then atomically replaces target."""
        tmp_file = file_path.with_suffix(f".tmp_{os.getpid()}_{datetime.now().timestamp()}")
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            tmp_file.replace(file_path)
        except Exception as e:
            if tmp_file.exists():
                tmp_file.unlink(missing_ok=True)
            logger.error(f"Failed to safely write JSON to {file_path}: {e}")
            raise

    def _read_json(self, file_path: Path) -> List[Dict[str, Any]]:
        """Reads JSON data from file or returns empty list if missing/invalid."""
        if not file_path.exists():
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Error reading JSON from {file_path}: {e}")
            return []

    # -------------------------------------------------------------------------
    # Seeding Realistic Demo Data
    # -------------------------------------------------------------------------

    def _initialize_storage(self) -> None:
        """Seeds initial synthetic demonstration content if data files are missing or empty."""
        posts = self._read_json(self.posts_file)
        if not posts:
            seed_posts = self._generate_seed_posts()
            self._safe_write_json(self.posts_file, seed_posts)
            logger.info(f"Seeded {len(seed_posts)} community posts to {self.posts_file}")

        reports = self._read_json(self.reports_file)
        if not reports:
            seed_reports = self._generate_seed_reports()
            self._safe_write_json(self.reports_file, seed_reports)
            logger.info(f"Seeded {len(seed_reports)} grievance reports to {self.reports_file}")

    def _generate_seed_posts(self) -> List[Dict[str, Any]]:
        return [
            {
                "post_id": "post_1001",
                "title": "Good tomato modal rates today at Kolar yard",
                "content": "Brought 45 crates of hybrid tomatoes to Kolar APMC this morning. Grade-1 lots fetched up to ₹2,450/qtl at 8:30 AM auction. Auction clearing was brisk and traders from Chennai were actively buying. Recommended to arrive before 7:00 AM to get a good parking slot near Shed 2.",
                "category": PostCategory.MARKET_PRICE.value,
                "author_name": "Basavaraj Gowda (Demo Farmer)",
                "author_id": "farmer_demo_101",
                "crop_id": "crop_tomato",
                "crop_name": "Tomato",
                "mandi_id": "mandi_kolar",
                "mandi_name": "Kolar APMC Market Yard",
                "district": "Kolar",
                "created_at": "2026-10-28T09:15:00Z",
                "helpful_count": 14,
                "comments_count": 2,
                "comments": [
                    {
                        "comment_id": "comm_1",
                        "post_id": "post_1001",
                        "author_name": "Suresh Patil (Demo Farmer)",
                        "author_id": "farmer_demo_102",
                        "content": "Thanks Basavaraj anna! Were there deductions for crates or was it standard net weighing?",
                        "created_at": "2026-10-28T10:05:00Z",
                        "is_demo": True
                    },
                    {
                        "comment_id": "comm_2",
                        "post_id": "post_1001",
                        "author_name": "Basavaraj Gowda (Demo Farmer)",
                        "author_id": "farmer_demo_101",
                        "content": "Standard 1.5 kg tare deduction per plastic crate as per APMC committee rules.",
                        "created_at": "2026-10-28T10:30:00Z",
                        "is_demo": True
                    }
                ],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "post_id": "post_1002",
                "title": "Hubballi onion arrivals surge — expect waiting times",
                "content": "Massive inflow of Bellary red onions at Amargol yard today. Over 180 trucks entered by dawn. Weighbridge queue is moving slowly (approx 2 hours delay). Modal price is steady around ₹2,100/qtl. If you have ambient storage available at your farm, holding for 3-4 days might avoid this congestion.",
                "category": PostCategory.MANDI_EXPERIENCE.value,
                "author_name": "Anand Kumar (Demo Farmer)",
                "author_id": "farmer_demo_103",
                "crop_id": "crop_onion",
                "crop_name": "Onion",
                "mandi_id": "mandi_hubballi",
                "mandi_name": "Hubballi (Amargol APMC)",
                "district": "Dharwad",
                "created_at": "2026-10-28T11:45:00Z",
                "helpful_count": 22,
                "comments_count": 1,
                "comments": [
                    {
                        "comment_id": "comm_3",
                        "post_id": "post_1002",
                        "author_name": "Mallikarjun B (Demo Farmer)",
                        "author_id": "farmer_demo_104",
                        "content": "Helpful heads up! I was loading 60 qtl in Navalgund, will delay dispatch until tomorrow night.",
                        "created_at": "2026-10-28T12:20:00Z",
                        "is_demo": True
                    }
                ],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "post_id": "post_1003",
                "title": "Please check your electronic weighbridge slip at Yeshwanthpur",
                "content": "When unloading potatoes at Yeshwanthpur platform 4, double check tare weight printed on the slip. My truck tare was printed as 2,450 kg whereas certified empty weight is 2,350 kg, resulting in an inadvertent 100 kg under-credit before I pointed it out to the weigh clerk who promptly recalibrated it. Always verify before leaving scale.",
                "category": PostCategory.WEIGHING_ISSUE.value,
                "author_name": "Manjunath S (Demo Farmer)",
                "author_id": "farmer_demo_105",
                "crop_id": "crop_potato",
                "crop_name": "Potato",
                "mandi_id": "mandi_bengaluru",
                "mandi_name": "Bengaluru (Yeshwanthpur APMC)",
                "district": "Bengaluru Urban",
                "created_at": "2026-10-27T16:20:00Z",
                "helpful_count": 31,
                "comments_count": 0,
                "comments": [],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "post_id": "post_1004",
                "title": "Commission agent settlement timelines in Hassan yard",
                "content": "Sold 80 quintals of Hassan potatoes last Thursday. Received 70% RTGS transfer within 24 hours, remaining balance settled on Monday. Good transparency compared to last season. APMC vigilance committee inspector was actively patrolling the auction platform.",
                "category": PostCategory.PAYMENT_DELAY.value,
                "author_name": "Shivanna R (Demo Farmer)",
                "author_id": "farmer_demo_106",
                "crop_id": "crop_potato",
                "crop_name": "Potato",
                "mandi_id": "mandi_hassan",
                "mandi_name": "Hassan APMC Yard",
                "district": "Hassan",
                "created_at": "2026-10-27T14:10:00Z",
                "helpful_count": 9,
                "comments_count": 0,
                "comments": [],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "post_id": "post_1005",
                "title": "Shared mini-truck transport from Davanagere to Hubballi",
                "content": "Looking for fellow maize or ragi growers near Harihar / Davanagere to pool 40 quintals for shared freight to Hubballi next Tuesday. Current individual quote is ₹220/km for 5-tonne canter; splitting will bring our freight down to roughly ₹1.80/km/qtl.",
                "category": PostCategory.TRANSPORT.value,
                "author_name": "Prakash Naik (Demo Farmer)",
                "author_id": "farmer_demo_107",
                "crop_id": "crop_maize",
                "crop_name": "Maize (Corn)",
                "mandi_id": "mandi_davanagere",
                "mandi_name": "Davanagere APMC Yard",
                "district": "Davanagere",
                "created_at": "2026-10-26T18:00:00Z",
                "helpful_count": 8,
                "comments_count": 0,
                "comments": [],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "post_id": "post_1006",
                "title": "Cold storage availability and humidity check in Belagavi",
                "content": "Belagavi private cold warehouse near highway has 300 qtl vacant chamber space for green chillies at ₹8.50/qtl/day. Temperature maintained at 8°C with 90% RH. Inspected the chamber personally. Ideal if market arrivals spike this weekend.",
                "category": PostCategory.STORAGE.value,
                "author_name": "Chennappa K (Demo Farmer)",
                "author_id": "farmer_demo_108",
                "crop_id": "crop_chilli",
                "crop_name": "Green Chilli",
                "mandi_id": "mandi_belagavi",
                "mandi_name": "Belagavi APMC Yard",
                "district": "Belagavi",
                "created_at": "2026-10-26T11:20:00Z",
                "helpful_count": 16,
                "comments_count": 0,
                "comments": [],
                "status": "active",
                "is_demo": True,
                "data_source": "synthetic"
            }
        ]

    def _generate_seed_reports(self) -> List[Dict[str, Any]]:
        return [
            {
                "report_id": "rep_2026_001",
                "issue_category": ReportCategory.UNEXPECTED_DEDUCTIONS.value,
                "farmer_id": "farmer_demo_user",
                "farmer_name": "Ramesh Patel (Demo Farmer)",
                "mandi_id": "mandi_kolar",
                "mandi_name": "Kolar APMC Market Yard",
                "district": "Kolar",
                "crop_id": "crop_tomato",
                "crop_name": "Tomato",
                "incident_date": "2026-10-24",
                "description": "Trader deducted ₹45 per quintal marked as 'unloading and sweeping charge' which exceeds the standard APMC statutory handling ceiling of ₹10/qtl. Auction slip receipt shows total deduction of ₹2,250 on a 50 quintal lot.",
                "approximate_amount": 2250.0,
                "status": ReportStatus.UNDER_REVIEW.value,
                "status_notes": "Assigned to Kolar APMC vigilance cell. Inspection officer requested transaction bill copy.",
                "created_at": "2026-10-25T10:30:00Z",
                "updated_at": "2026-10-26T14:00:00Z",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "report_id": "rep_2026_002",
                "issue_category": ReportCategory.PAYMENT_DELAY.value,
                "farmer_id": "farmer_demo_user",
                "farmer_name": "Ramesh Patel (Demo Farmer)",
                "mandi_id": "mandi_bengaluru",
                "mandi_name": "Bengaluru (Yeshwanthpur APMC)",
                "district": "Bengaluru Urban",
                "crop_id": "crop_onion",
                "crop_name": "Onion",
                "incident_date": "2026-10-18",
                "description": "Sold 60 quintals on October 18th. Commission merchant promised NEFT by next business day. Remainder amount of ₹38,000 has been overdue for over 7 days despite 3 phone follow-ups.",
                "approximate_amount": 38000.0,
                "status": ReportStatus.INFO_NEEDED.value,
                "status_notes": "Please provide the commission agent stall number or trade license number from your auction voucher.",
                "created_at": "2026-10-20T08:15:00Z",
                "updated_at": "2026-10-23T11:45:00Z",
                "is_demo": True,
                "data_source": "synthetic"
            },
            {
                "report_id": "rep_2026_003",
                "issue_category": ReportCategory.INCORRECT_WEIGHING.value,
                "farmer_id": "farmer_demo_109",
                "farmer_name": "Govindappa (Demo Farmer)",
                "mandi_id": "mandi_mysuru",
                "mandi_name": "Mysuru (Bandipalya APMC)",
                "district": "Mysuru",
                "crop_id": "crop_ragi",
                "crop_name": "Ragi",
                "incident_date": "2026-10-12",
                "description": "Manual balance beam scale at Gate 3 showed 94 kg per bag, whereas village certified scale weighed exactly 100 kg per bag across 30 bags.",
                "approximate_amount": 7500.0,
                "status": ReportStatus.RESOLVED.value,
                "status_notes": "APMC weights and measures inspector recalibrated the beam scale on Oct 14. Trader compensated the 180 kg difference.",
                "created_at": "2026-10-12T16:00:00Z",
                "updated_at": "2026-10-15T09:30:00Z",
                "is_demo": True,
                "data_source": "synthetic"
            }
        ]

    # -------------------------------------------------------------------------
    # Community Posts Operations
    # -------------------------------------------------------------------------

    def list_posts(
        self,
        category: Optional[str] = None,
        crop_id: Optional[str] = None,
        mandi_id: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "latest",
        include_hidden: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[PostResponse], int]:
        """Lists posts with filtering, search and moderation visibility rules."""
        raw_posts = self._read_json(self.posts_file)
        filtered = []

        for p in raw_posts:
            # Moderation filter
            if not include_hidden and p.get("status") == "hidden":
                continue

            # Category filter
            if category and category.strip():
                if p.get("category", "").lower() != category.strip().lower():
                    continue

            # Crop filter
            if crop_id and crop_id.strip():
                if p.get("crop_id") != crop_id.strip():
                    continue

            # Mandi filter
            if mandi_id and mandi_id.strip():
                if p.get("mandi_id") != mandi_id.strip():
                    continue

            # Search text query
            if search and search.strip():
                q = search.strip().lower()
                title_match = q in (p.get("title") or "").lower()
                content_match = q in (p.get("content") or "").lower()
                mandi_match = q in (p.get("mandi_name") or "").lower()
                crop_match = q in (p.get("crop_name") or "").lower()
                if not (title_match or content_match or mandi_match or crop_match):
                    continue

            filtered.append(PostResponse(**p))

        # Sorting
        if sort_by == "latest":
            filtered.sort(key=lambda x: x.created_at, reverse=True)
        elif sort_by == "helpful":
            filtered.sort(key=lambda x: x.helpful_count, reverse=True)

        total = len(filtered)
        paginated = filtered[offset : offset + limit]
        return paginated, total

    def get_post(self, post_id: str) -> Optional[PostResponse]:
        """Retrieves a single post by ID."""
        raw_posts = self._read_json(self.posts_file)
        for p in raw_posts:
            if p.get("post_id") == post_id:
                return PostResponse(**p)
        return None

    def create_post(self, post_data: PostCreate) -> PostResponse:
        """Creates a new post and persists atomically."""
        raw_posts = self._read_json(self.posts_file)

        # Generate unique post_id
        timestamp_id = int(datetime.now().timestamp() * 1000)
        new_id = f"post_{timestamp_id}"

        # Resolve crop metadata
        crop_name = None
        if post_data.crop_id:
            c = self.mandi_service.find_crop(post_data.crop_id)
            if c:
                crop_name = c.name_en

        # Resolve mandi metadata
        mandi_name = None
        district = None
        if post_data.mandi_id:
            m = self.mandi_service.get_mandi_by_id(post_data.mandi_id)
            if m:
                mandi_name = m.name
                district = m.district

        new_post_dict = {
            "post_id": new_id,
            "title": post_data.title,
            "content": post_data.content,
            "category": post_data.category.value,
            "author_name": post_data.author_name or "Ramesh Patel (Demo Farmer)",
            "author_id": post_data.author_id or "farmer_demo_user",
            "crop_id": post_data.crop_id,
            "crop_name": crop_name,
            "mandi_id": post_data.mandi_id,
            "mandi_name": mandi_name,
            "district": district,
            "created_at": _now_utc_iso(),
            "helpful_count": 0,
            "comments_count": 0,
            "comments": [],
            "status": "active",
            "is_demo": True,
            "data_source": "synthetic"
        }

        # Insert at the beginning (latest first)
        raw_posts.insert(0, new_post_dict)
        self._safe_write_json(self.posts_file, raw_posts)
        return PostResponse(**new_post_dict)

    def add_comment(self, post_id: str, comment_data: CommentCreate) -> Optional[CommentResponse]:
        """Appends a validated comment to a post."""
        raw_posts = self._read_json(self.posts_file)
        target_post = None

        for p in raw_posts:
            if p.get("post_id") == post_id:
                target_post = p
                break

        if not target_post:
            return None

        comment_id = f"comm_{int(datetime.now().timestamp() * 1000)}"
        new_comment_dict = {
            "comment_id": comment_id,
            "post_id": post_id,
            "author_name": comment_data.author_name or "Ramesh Patel (Demo Farmer)",
            "author_id": comment_data.author_id or "farmer_demo_user",
            "content": comment_data.content,
            "created_at": _now_utc_iso(),
            "is_demo": True
        }

        if "comments" not in target_post or not isinstance(target_post["comments"], list):
            target_post["comments"] = []

        target_post["comments"].append(new_comment_dict)
        target_post["comments_count"] = len(target_post["comments"])

        self._safe_write_json(self.posts_file, raw_posts)
        return CommentResponse(**new_comment_dict)

    def toggle_helpful(self, post_id: str) -> Optional[PostResponse]:
        """Increments helpful upvote count for a post."""
        raw_posts = self._read_json(self.posts_file)
        target_post = None

        for p in raw_posts:
            if p.get("post_id") == post_id:
                target_post = p
                break

        if not target_post:
            return None

        curr = target_post.get("helpful_count", 0)
        target_post["helpful_count"] = max(0, curr + 1)

        self._safe_write_json(self.posts_file, raw_posts)
        return PostResponse(**target_post)

    # -------------------------------------------------------------------------
    # Grievance Reports Operations
    # -------------------------------------------------------------------------

    def list_reports(
        self,
        farmer_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ReportResponse]:
        """Lists grievance reports with optional farmer or status filter."""
        raw_reports = self._read_json(self.reports_file)
        results = []

        for r in raw_reports:
            if farmer_id and r.get("farmer_id") != farmer_id:
                continue
            if status and r.get("status") != status:
                continue
            results.append(ReportResponse(**r))

        results.sort(key=lambda x: x.created_at, reverse=True)
        return results

    def get_report(self, report_id: str) -> Optional[ReportResponse]:
        """Retrieves a single grievance report by reference ID."""
        raw_reports = self._read_json(self.reports_file)
        for r in raw_reports:
            if r.get("report_id") == report_id:
                return ReportResponse(**r)
        return None

    def create_report(self, report_data: ReportCreate) -> ReportResponse:
        """Creates a new grievance report."""
        raw_reports = self._read_json(self.reports_file)

        # Generate human-readable reference ID
        year = datetime.now().year
        seq = len(raw_reports) + 1
        new_id = f"rep_{year}_{seq:03d}"

        # Resolve mandi
        m = self.mandi_service.get_mandi_by_id(report_data.mandi_id)
        mandi_name = m.name if m else report_data.mandi_id
        district = m.district if m else None

        # Resolve crop
        crop_name = None
        if report_data.crop_id:
            c = self.mandi_service.find_crop(report_data.crop_id)
            if c:
                crop_name = c.name_en

        now = _now_utc_iso()
        new_report_dict = {
            "report_id": new_id,
            "issue_category": report_data.issue_category.value,
            "farmer_id": report_data.farmer_id or "farmer_demo_user",
            "farmer_name": report_data.farmer_name or "Ramesh Patel (Demo Farmer)",
            "mandi_id": report_data.mandi_id,
            "mandi_name": mandi_name,
            "district": district,
            "crop_id": report_data.crop_id,
            "crop_name": crop_name,
            "incident_date": report_data.incident_date,
            "description": report_data.description,
            "approximate_amount": report_data.approximate_amount,
            "status": ReportStatus.SUBMITTED.value,
            "status_notes": "Report registered in system. Pending APMC demonstration moderation review.",
            "created_at": now,
            "updated_at": now,
            "is_demo": True,
            "data_source": "synthetic"
        }

        raw_reports.insert(0, new_report_dict)
        self._safe_write_json(self.reports_file, raw_reports)
        return ReportResponse(**new_report_dict)

    # -------------------------------------------------------------------------
    # Moderation Actions
    # -------------------------------------------------------------------------

    def update_post_status(self, post_id: str, new_status: str) -> Optional[PostResponse]:
        """Toggles post status between 'active' and 'hidden'."""
        if new_status not in ["active", "hidden"]:
            raise ValueError("Status must be either 'active' or 'hidden'.")

        raw_posts = self._read_json(self.posts_file)
        target = None
        for p in raw_posts:
            if p.get("post_id") == post_id:
                target = p
                break

        if not target:
            return None

        target["status"] = new_status
        self._safe_write_json(self.posts_file, raw_posts)
        return PostResponse(**target)

    def update_report_status(
        self,
        report_id: str,
        new_status: ReportStatus,
        notes: Optional[str] = None
    ) -> Optional[ReportResponse]:
        """Updates report status according to valid lifecycle state transitions."""
        raw_reports = self._read_json(self.reports_file)
        target = None
        for r in raw_reports:
            if r.get("report_id") == report_id:
                target = r
                break

        if not target:
            return None

        current_status = target.get("status")

        # Lifecycle validation
        valid_transitions = {
            ReportStatus.SUBMITTED.value: [ReportStatus.UNDER_REVIEW.value, ReportStatus.CLOSED.value],
            ReportStatus.UNDER_REVIEW.value: [
                ReportStatus.INFO_NEEDED.value,
                ReportStatus.RESOLVED.value,
                ReportStatus.CLOSED.value
            ],
            ReportStatus.INFO_NEEDED.value: [
                ReportStatus.UNDER_REVIEW.value,
                ReportStatus.RESOLVED.value,
                ReportStatus.CLOSED.value
            ],
            ReportStatus.RESOLVED.value: [ReportStatus.CLOSED.value, ReportStatus.UNDER_REVIEW.value],
            ReportStatus.CLOSED.value: [ReportStatus.UNDER_REVIEW.value]
        }

        allowed = valid_transitions.get(current_status, [])
        if new_status.value != current_status and new_status.value not in allowed:
            raise ValueError(
                f"Invalid status transition from '{current_status}' to '{new_status.value}'. "
                f"Permitted transitions: {allowed}"
            )

        target["status"] = new_status.value
        if notes:
            target["status_notes"] = notes
        target["updated_at"] = _now_utc_iso()

        self._safe_write_json(self.reports_file, raw_reports)
        return ReportResponse(**target)

    def get_moderation_queue(self) -> ModerationQueueResponse:
        """Retrieves moderation queue with pending items and aggregate counts."""
        raw_reports = self._read_json(self.reports_file)
        raw_posts = self._read_json(self.posts_file)

        reports_list = [ReportResponse(**r) for r in raw_reports]
        posts_list = [PostResponse(**p) for p in raw_posts]

        pending_reports = sum(1 for r in reports_list if r.status in [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW, ReportStatus.INFO_NEEDED])
        hidden_posts = sum(1 for p in posts_list if p.status == "hidden")

        return ModerationQueueResponse(
            pending_reports_count=pending_reports,
            hidden_posts_count=hidden_posts,
            total_posts=len(posts_list),
            total_reports=len(reports_list),
            reports=reports_list,
            posts=posts_list,
            is_demo=True
        )
