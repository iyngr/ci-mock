import azure.functions as func
import datetime
import logging
import os
import json
from azure.cosmos import CosmosClient, exceptions


app = func.FunctionApp()


@app.timer_trigger(schedule="0 */5 * * * *", arg_name="mytimer", run_on_startup=False,
              use_monitor=False) 
def auto_submit_expired_assessments(mytimer: func.TimerRequest) -> None:
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
