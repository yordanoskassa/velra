from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
from routes.news import _fetch_and_save_headlines
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create scheduler
scheduler = AsyncIOScheduler()

async def fetch_headlines_immediately():
    """Fetch headlines immediately on startup"""
    logger.info("Fetching headlines immediately on startup...")
    try:
        await _fetch_and_save_headlines()
        logger.info("Initial headlines fetch completed successfully")
    except Exception as e:
        logger.error(f"Error during initial headlines fetch: {e}")

def setup_scheduler():
    """Set up scheduled tasks"""
    try:
        # Fetch headlines immediately on startup
        asyncio.create_task(fetch_headlines_immediately())
        
        # Add job to fetch headlines every 2 hours
        scheduler.add_job(
            _fetch_and_save_headlines,
            trigger=IntervalTrigger(hours=2),
            id="fetch_headlines",
            name="Fetch headlines from RapidAPI",
            replace_existing=True
        )
        
        # Log scheduled jobs
        logger.info("Scheduled jobs:")
        for job in scheduler.get_jobs():
            logger.info(f"  - {job.name} (ID: {job.id})")
        
        # Start the scheduler
        scheduler.start()
        logger.info("Scheduler started")
    except Exception as e:
        logger.error(f"Error setting up scheduler: {e}") 