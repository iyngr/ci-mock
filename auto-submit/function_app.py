import azure.functions as func
import datetime
import logging
import os
from azure.cosmos import CosmosClient


app = func.FunctionApp()


@app.timer_trigger(schedule="0 */5 * * * *", arg_name="mytimer", run_on_startup=False,
              use_monitor=False) 
async def auto_submit_expired_assessments(mytimer: func.TimerRequest) -> None:
    """
    Azure Function that runs every 5 minutes to auto-submit expired assessments.
    CRON expression: "0 */5 * * * *" means run at minute 0 of every 5th minute
    """
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()

    if mytimer.past_due:
        logging.info('The timer is past due!')

    logging.info('Auto-submit function executed at %s', utc_timestamp)

    try:
        # Initialize Cosmos DB client
        cosmos_client = get_cosmos_client()
        database = cosmos_client.get_database_client(os.environ["COSMOS_DB_NAME"])
        submissions_container = database.get_container_client("submissions")
        
        # Query for expired in-progress submissions
        current_time = datetime.datetime.utcnow()
        
        query = """
        SELECT * FROM c 
        WHERE c.status = 'in-progress' 
        AND c.expiration_time < @current_time
        """
        
        parameters = [
            {"name": "@current_time", "value": current_time.isoformat()}
        ]
        
        expired_submissions = list(submissions_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        logging.info(f'Found {len(expired_submissions)} expired submissions to auto-submit')
        
        # Process each expired submission
        auto_submitted_count = 0
        for submission in expired_submissions:
            try:
                # Update submission status to auto-submitted
                submission['status'] = 'completed_auto_submitted'
                submission['submitted_at'] = current_time.isoformat()
                
                # Update the document in Cosmos DB
                submissions_container.upsert_item(submission)
                auto_submitted_count += 1
                
                logging.info(f'Auto-submitted assessment for submission ID: {submission["id"]}')
                
                # Optional: Trigger AI scoring service
                # await trigger_ai_scoring(submission)
                
            except Exception as e:
                logging.error(f'Failed to auto-submit submission {submission.get("id", "unknown")}: {str(e)}')
        
        logging.info(f'Successfully auto-submitted {auto_submitted_count} expired assessments')
        
        # Also process expired S2S interview transcripts
        await process_expired_s2s_interviews(database)
        
    except Exception as e:
        logging.error(f'Error in auto-submit function: {str(e)}')
        raise


def get_cosmos_client():
    """
    Initialize Cosmos DB client using connection string or managed identity
    """
    try:
        # Option 1: Using connection string (for development/testing)
        connection_string = os.environ.get("COSMOS_DB_CONNECTION_STRING")
        if connection_string:
            return CosmosClient.from_connection_string(connection_string)
        
        # Option 2: Using managed identity (recommended for production)
        cosmos_endpoint = os.environ.get("COSMOS_DB_ENDPOINT")
        if cosmos_endpoint:
            from azure.identity import DefaultAzureCredential
            credential = DefaultAzureCredential()
            return CosmosClient(cosmos_endpoint, credential)
        
        # Option 3: Using account key (fallback)
        cosmos_endpoint = os.environ["COSMOS_DB_ENDPOINT"]
        cosmos_key = os.environ["COSMOS_DB_KEY"]
        return CosmosClient(cosmos_endpoint, cosmos_key)
        
    except KeyError as e:
        logging.error(f"Missing required environment variable: {e}")
        raise
    except Exception as e:
        logging.error(f"Failed to initialize Cosmos DB client: {e}")
        raise

import urllib.parse

# Allowlist for AI scoring endpoints (full URLs or hostnames)
ALLOWED_SCORING_ENDPOINTS = [
    # Add allowed full URLs here, e.g. "https://ai.yourcompany.com/score"
    # Or just allowed hostnames, e.g. "ai.yourcompany.com"
    # Examples (replace or extend as appropriate for your environment):
    "https://ai.yourcompany.com/score",
    "https://prod.scoring.service/score",
]
# ALLOWED_SCORING_HOSTNAMES removed for SSRF hardening

def is_allowed_endpoint(url):
    try:
        # Only allow exact full URLs. No host-based allowlisting.
        return url in ALLOWED_SCORING_ENDPOINTS
    except Exception:
        return False


async def trigger_ai_scoring(submission: dict):
    """
    Optional: Trigger AI scoring service for auto-submitted assessment
    This could call your existing evaluation endpoint or Azure Logic Apps
    """
    try:
        import aiohttp
        
        scoring_endpoint = os.environ.get("AI_SCORING_ENDPOINT")
        if not scoring_endpoint:
            logging.warning("AI_SCORING_ENDPOINT not configured, skipping AI scoring")
            return
        # Ensure only exact full URLs from allowlist are allowed.
        if not is_allowed_endpoint(scoring_endpoint):
            logging.error(f"Configured AI_SCORING_ENDPOINT '{scoring_endpoint}' is not an exact match in the allowed endpoint list. Skipping AI scoring trigger.")
            return
        
        
        payload = {
            "submission_id": submission["id"],
            "test_id": submission["test_id"],
            "candidate_email": submission["candidate_email"],
            "auto_submitted": True
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                scoring_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    logging.info(f"Successfully triggered AI scoring for submission {submission['id']}")
                else:
                    logging.warning(f"AI scoring trigger failed with status {response.status}")
                    
    except Exception as e:
        logging.error(f"Failed to trigger AI scoring for submission {submission.get('id', 'unknown')}: {str(e)}")


async def process_expired_s2s_interviews(database):
    """
    Process expired S2S interview transcripts for automatic evaluation
    """
    try:
        transcripts_container = database.get_container_client("interview_transcripts")
        current_time = datetime.datetime.utcnow()
        
        # Query for finalized transcripts that haven't been scored yet
        # and are older than a buffer period (e.g., 5 minutes after finalization)
        buffer_time = current_time - datetime.timedelta(minutes=5)
        
        query = """
        SELECT * FROM c 
        WHERE c.finalized_at != null
        AND c.scored_at = null
        AND c.finalized_at < @buffer_time
        """
        
        parameters = [
            {"name": "@buffer_time", "value": buffer_time.timestamp()}
        ]
        
        expired_transcripts = list(transcripts_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        logging.info(f'Found {len(expired_transcripts)} S2S interview transcripts to process')
        
        # Process each expired transcript
        processed_count = 0
        for transcript in expired_transcripts:
            try:
                # Generate assessment from S2S transcript
                score_result = await generate_s2s_assessment_score(transcript)
                
                # Update transcript with scoring results
                transcript['scored_at'] = current_time.timestamp()
                transcript['assessment_score'] = score_result.get('score', 0)
                transcript['assessment_feedback'] = score_result.get('feedback', '')
                transcript['assessment_details'] = score_result.get('details', {})
                
                # Update the document in Cosmos DB
                transcripts_container.upsert_item(transcript)
                processed_count += 1
                
                logging.info(f'Processed S2S interview transcript for session: {transcript["session_id"]}')
                
                # Optionally trigger report generation
                await trigger_s2s_report_generation(transcript)
                
            except Exception as e:
                logging.error(f'Failed to process S2S transcript {transcript.get("session_id", "unknown")}: {str(e)}')
        
        logging.info(f'Successfully processed {processed_count} S2S interview transcripts')
        
    except Exception as e:
        logging.error(f'Error processing S2S interview transcripts: {str(e)}')


async def generate_s2s_assessment_score(transcript: dict) -> dict:
    """
    Generate assessment score from S2S interview transcript using LLM-agent
    """
    try:
        # Extract relevant data from transcript
        session_id = transcript.get("session_id", "unknown")
        turns = transcript.get("turns", [])
        metadata = transcript.get("metadata", {})
        
        # Create a pseudo-submission for the LLM-agent scoring system
        pseudo_submission = {
            "id": f"s2s_{session_id}",
            "candidate_email": metadata.get("candidate_email", "unknown"),
            "test_id": metadata.get("test_id", "unknown"),
            "submission_type": "s2s_interview",
            "interview_transcript": {
                "session_id": session_id,
                "turns": turns,
                "duration": metadata.get("duration", 0),
                "questions_covered": metadata.get("questions_covered", [])
            }
        }
        
        # Call LLM-agent for scoring
        llm_agent_endpoint = os.environ.get("LLM_AGENT_ENDPOINT", "http://localhost:8080")
        scoring_url = f"{llm_agent_endpoint}/generate-report"
        
        payload = {
            "submission_id": pseudo_submission["id"],
            "debug_mode": False
        }
        
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                scoring_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=300)  # 5 minute timeout for AI processing
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # Extract meaningful score from AI report
                    report_content = result.get("report", "")
                    
                    # Simple scoring based on transcript analysis
                    # This could be enhanced with more sophisticated AI evaluation
                    base_score = calculate_base_s2s_score(turns, metadata)
                    
                    return {
                        "score": base_score,
                        "feedback": report_content,
                        "details": {
                            "turns_count": len(turns),
                            "duration": metadata.get("duration", 0),
                            "questions_covered": len(metadata.get("questions_covered", [])),
                            "ai_report": report_content
                        }
                    }
                else:
                    logging.warning(f"LLM-agent scoring failed with status {response.status}")
                    # Fallback to basic scoring
                    return generate_fallback_s2s_score(transcript)
                    
    except Exception as e:
        logging.error(f"Failed to generate S2S assessment score: {str(e)}")
        return generate_fallback_s2s_score(transcript)


def calculate_base_s2s_score(turns: list, metadata: dict) -> float:
    """
    Calculate a base score for S2S interview based on transcript metrics
    """
    try:
        # Basic scoring factors
        turns_count = len(turns)
        duration = metadata.get("duration", 0)
        questions_covered = len(metadata.get("questions_covered", []))
        
        # Scoring weights
        participation_score = min(turns_count / 20.0, 1.0) * 30  # Max 30 points for participation
        duration_score = min(duration / 1800.0, 1.0) * 20  # Max 20 points for 30+ min duration
        coverage_score = min(questions_covered / 5.0, 1.0) * 50  # Max 50 points for question coverage
        
        total_score = participation_score + duration_score + coverage_score
        return min(total_score, 100.0)  # Cap at 100
        
    except Exception:
        return 50.0  # Default middle score


def generate_fallback_s2s_score(transcript: dict) -> dict:
    """
    Generate a fallback score when AI processing fails
    """
    turns = transcript.get("turns", [])
    metadata = transcript.get("metadata", {})
    base_score = calculate_base_s2s_score(turns, metadata)
    
    return {
        "score": base_score,
        "feedback": "Assessment completed based on interview participation and duration. Detailed AI analysis was not available.",
        "details": {
            "turns_count": len(turns),
            "duration": metadata.get("duration", 0),
            "questions_covered": len(metadata.get("questions_covered", [])),
            "scoring_method": "fallback_heuristic"
        }
    }


async def trigger_s2s_report_generation(transcript: dict):
    """
    Optional: Trigger additional report generation for S2S interview
    """
    try:
        # This could trigger additional reporting workflows
        # For now, just log the completion
        session_id = transcript.get("session_id", "unknown")
        score = transcript.get("assessment_score", 0)
        
        logging.info(f"S2S interview assessment completed - Session: {session_id}, Score: {score}")
        
        # Could trigger notifications, email reports, etc.
        
    except Exception as e:
        logging.error(f"Failed to trigger S2S report generation: {str(e)}")


# New: daily cleanup function (no stored-proc) to mark reserved submissions expired and optionally archive auto-created assessments
@app.timer_trigger(schedule="0 0 2 * * *", arg_name="cleanupTimer", run_on_startup=False, use_monitor=False)
async def daily_cleanup_reserved_submissions(cleanupTimer: func.TimerRequest) -> None:
    """
    Daily timer (02:00 UTC) that:
      - finds `submissions` with status 'reserved' and expires_at < now, marks them 'expired'
      - for auto-created assessments older than CLEANUP_ASSESSMENT_AGE_DAYS, if they have no non-expired submissions, mark the assessment 'archived'

    This function is independent from auto_submit_expired_assessments and uses safe SDK calls.
    """
    now = datetime.datetime.utcnow()
    now_iso = now.isoformat()

    if cleanupTimer.past_due:
        logging.info('daily_cleanup_reserved_submissions: Timer is past due')

    try:
        cosmos_client = get_cosmos_client()
        database = cosmos_client.get_database_client(os.environ["COSMOS_DB_NAME"])
        submissions_container = database.get_container_client("submissions")
        assessments_container = database.get_container_client("assessments")

        # 1) Mark reserved submissions expired
        # Query only reserved submissions that are past their expires_at
        query_reserved = "SELECT * FROM c WHERE c.status = 'reserved' AND c.expires_at < @now"
        params = [{"name": "@now", "value": now_iso}]

        logging.info('daily_cleanup_reserved_submissions: querying expired reserved submissions')
        expired_reserved = submissions_container.query_items(
            query=query_reserved,
            parameters=params,
            enable_cross_partition_query=True
        )

        updated = 0
        async for doc in async_iterable(expired_reserved):
            try:
                doc['status'] = 'expired'
                doc['expired_at'] = now_iso
                # preserve previous fields; upsert to avoid partition resolution issues
                submissions_container.upsert_item(doc)
                updated += 1
            except Exception as e:
                logging.exception('Failed to mark submission expired: %s', e)

        logging.info('daily_cleanup_reserved_submissions: marked %s reserved submissions expired', updated)

        # 2) Archive auto-created assessments older than threshold if they have no non-expired submissions
        days_threshold = int(os.environ.get('CLEANUP_ASSESSMENT_AGE_DAYS', '7'))
        threshold_dt = now - datetime.timedelta(days=days_threshold)
        threshold_iso = threshold_dt.isoformat()

        query_assess = "SELECT c.id FROM c WHERE c.auto_created = true AND c.created_at < @threshold"
        assess_params = [{"name": "@threshold", "value": threshold_iso}]

        logging.info('daily_cleanup_reserved_submissions: querying candidate auto-created assessments')
        candidates = assessments_container.query_items(
            query=query_assess,
            parameters=assess_params,
            enable_cross_partition_query=True
        )

        archived = 0
        for a in candidates:
            aid = a.get('id')
            if not aid:
                continue
            try:
                # Count non-expired submissions for this assessment
                count_query = "SELECT VALUE COUNT(1) FROM c WHERE c.assessment_id = @aid AND c.status != @expired"
                count_params = [
                    {"name": "@aid", "value": aid},
                    {"name": "@expired", "value": "expired"}
                ]
                res = list(submissions_container.query_items(
                    query=count_query,
                    parameters=count_params,
                    enable_cross_partition_query=True
                ))
                remaining = res[0] if res else 0
                logging.info('Assessment %s remaining non-expired submissions: %s', aid, remaining)
                if remaining == 0:
                    try:
                        # Read and update assessment status
                        assessment = assessments_container.read_item(item=aid, partition_key=aid)
                        assessment['status'] = 'archived'
                        assessment['archived_at'] = now_iso
                        assessments_container.replace_item(item=aid, body=assessment)
                        archived += 1
                        logging.info('Archived assessment %s', aid)
                    except Exception as e:
                        logging.exception('Failed to archive assessment %s: %s', aid, e)
            except Exception as e:
                logging.exception('Error checking submissions for assessment %s: %s', aid, e)

        logging.info('daily_cleanup_reserved_submissions done. archived=%s', archived)

    except Exception as e:
        logging.exception('Error in daily_cleanup_reserved_submissions: %s', e)
        # Do not raise; we want isolation from other timers
        return


def async_iterable(sync_iterable):
    """Small helper to adapt SDK sync iterable to async for loops in this file.

    The azure-cosmos SDK returns a generator; to keep this function simple and
    avoid adding an async SDK dependency, we adapt by yielding synchronously.
    """
    for it in sync_iterable:
        yield it
