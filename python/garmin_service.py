#!/usr/bin/env python3
"""
Garmin Connect data fetching service.
Called from SvelteKit via subprocess.

This service de-personalizes data by stripping all user identifiers
and only returning health metrics.
"""
import sys
import json
import os
from datetime import date, timedelta
from pathlib import Path
from garminconnect import Garmin

# Default token storage location (for local/single-user mode)
DEFAULT_TOKENSTORE = str(Path.home() / ".garminconnect")

# Per-user token storage base directory (for multi-user hosted mode)
USER_TOKENSTORE_BASE = str(Path.home() / ".garminconnect-users")


def get_tokenstore(user_id: str = None) -> str:
    """Get token store path for a specific user or default."""
    # Use default location for local-user (local mode) or no user_id
    if not user_id or user_id == "local-user":
        return DEFAULT_TOKENSTORE
    # Use per-user directory for hosted multi-user mode
    base = Path(USER_TOKENSTORE_BASE)
    base.mkdir(parents=True, exist_ok=True)
    return str(base / user_id)


def get_client(user_id: str = None):
    """Initialize Garmin client with saved tokens."""
    tokenstore = get_tokenstore(user_id)
    if not Path(tokenstore).exists():
        raise Exception("Not authenticated. Please authenticate first.")

    client = Garmin()
    client.login(tokenstore)
    return client


def depersonalize_sleep(data: dict) -> dict:
    """Remove personal identifiers from sleep data, keep only metrics."""
    if not data:
        return {}

    # Sleep data is nested inside dailySleepDTO
    sleep = data.get("dailySleepDTO", data)
    if not sleep:
        return {}

    # Get sleep scores - nested structure
    sleep_scores = sleep.get("sleepScores", {})
    overall_score = None
    if sleep_scores and isinstance(sleep_scores, dict):
        overall = sleep_scores.get("overall", {})
        if isinstance(overall, dict):
            overall_score = overall.get("value")

    return {
        "calendarDate": sleep.get("calendarDate"),
        "sleepTimeSeconds": sleep.get("sleepTimeSeconds"),
        "deepSleepSeconds": sleep.get("deepSleepSeconds"),
        "lightSleepSeconds": sleep.get("lightSleepSeconds"),
        "remSleepSeconds": sleep.get("remSleepSeconds"),
        "awakeSleepSeconds": sleep.get("awakeSleepSeconds"),
        "sleepScore": overall_score,
        "averageSpO2Value": sleep.get("averageSpO2Value"),
        "averageRespirationValue": sleep.get("averageRespirationValue"),
        "sleepStartTimestampGMT": sleep.get("sleepStartTimestampGMT"),
        "sleepEndTimestampGMT": sleep.get("sleepEndTimestampGMT"),
        "avgSleepStress": sleep.get("avgSleepStress"),
    }


def depersonalize_activity(data: dict) -> dict:
    """Remove personal identifiers from activity summary."""
    if not data:
        return {}

    return {
        "calendarDate": data.get("calendarDate"),
        "totalSteps": data.get("totalSteps"),
        "totalDistanceMeters": data.get("totalDistanceMeters"),
        "activeKilocalories": data.get("activeKilocalories"),
        "totalKilocalories": data.get("totalKilocalories"),
        "floorsAscended": data.get("floorsAscended"),
        "floorsDescended": data.get("floorsDescended"),
        "intensityMinutesGoal": data.get("intensityMinutesGoal"),
        "moderateIntensityMinutes": data.get("moderateIntensityMinutes"),
        "vigorousIntensityMinutes": data.get("vigorousIntensityMinutes"),
        "restingHeartRate": data.get("restingHeartRate"),
        "minHeartRate": data.get("minHeartRate"),
        "maxHeartRate": data.get("maxHeartRate"),
        "averageStressLevel": data.get("averageStressLevel"),
        "maxStressLevel": data.get("maxStressLevel"),
        "stressDuration": data.get("stressDuration"),
        "restStressDuration": data.get("restStressDuration"),
        "activityStressDuration": data.get("activityStressDuration"),
        "lowStressDuration": data.get("lowStressDuration"),
        "mediumStressDuration": data.get("mediumStressDuration"),
        "highStressDuration": data.get("highStressDuration"),
        "bodyBatteryChargedValue": data.get("bodyBatteryChargedValue"),
        "bodyBatteryDrainedValue": data.get("bodyBatteryDrainedValue"),
        "bodyBatteryHighestValue": data.get("bodyBatteryHighestValue"),
        "bodyBatteryLowestValue": data.get("bodyBatteryLowestValue"),
        "bodyBatteryMostRecentValue": data.get("bodyBatteryMostRecentValue"),
    }


def depersonalize_stress(data: dict) -> dict:
    """Remove personal identifiers from stress data."""
    if not data:
        return {}

    return {
        "calendarDate": data.get("calendarDate"),
        "overallStressLevel": data.get("overallStressLevel"),
        "restStressDuration": data.get("restStressDuration"),
        "activityStressDuration": data.get("activityStressDuration"),
        "lowStressDuration": data.get("lowStressDuration"),
        "mediumStressDuration": data.get("mediumStressDuration"),
        "highStressDuration": data.get("highStressDuration"),
        "stressQualifier": data.get("stressQualifier"),
    }


def depersonalize_body_battery(data: list) -> list:
    """Remove personal identifiers from body battery data."""
    if not data:
        return []

    return [
        {
            "startTimestampGMT": item.get("startTimestampGMT"),
            "endTimestampGMT": item.get("endTimestampGMT"),
            "bodyBatteryLevel": item.get("bodyBatteryLevel"),
            "bodyBatteryStatus": item.get("bodyBatteryStatus"),
        }
        for item in data
        if isinstance(item, dict)
    ]


def depersonalize_heart_rate(data: dict) -> dict:
    """Remove personal identifiers from heart rate data."""
    if not data:
        return {}

    return {
        "calendarDate": data.get("calendarDate"),
        "restingHeartRate": data.get("restingHeartRate"),
        "maxHeartRate": data.get("maxHeartRate"),
        "minHeartRate": data.get("minHeartRate"),
        "heartRateValues": data.get("heartRateValues"),  # Time series data
    }


def authenticate(email: str, password: str, user_id: str = None) -> dict:
    """Initial authentication with Garmin Connect."""
    try:
        client = Garmin(email, password)
        client.login()
        tokenstore = get_tokenstore(user_id)
        Path(tokenstore).mkdir(parents=True, exist_ok=True)
        client.garth.dump(tokenstore)
        return {"success": True, "message": "Authentication successful"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_auth(user_id: str = None) -> dict:
    """Check if we have valid authentication."""
    try:
        client = get_client(user_id)
        # Try to fetch something to verify tokens work
        client.get_full_name()  # This won't be stored, just used for verification
        return {"authenticated": True}
    except Exception:
        return {"authenticated": False}


def fetch_sleep_data(target_date: str, user_id: str = None) -> dict:
    """Fetch sleep data for a specific date, including HR during sleep."""
    try:
        client = get_client(user_id)
        data = client.get_sleep_data(target_date)
        sleep_result = depersonalize_sleep(data)

        # Try to get heart rate during sleep
        try:
            hr_data = client.get_heart_rates(target_date)
            hr_values = hr_data.get('heartRateValues', [])
            sleep_start = sleep_result.get('sleepStartTimestampGMT')
            sleep_end = sleep_result.get('sleepEndTimestampGMT')

            if hr_values and sleep_start and sleep_end:
                sleep_hr = [v[1] for v in hr_values if v[0] and sleep_start <= v[0] <= sleep_end and v[1]]
                if sleep_hr:
                    sleep_result['avgSleepHR'] = round(sum(sleep_hr) / len(sleep_hr))
                    sleep_result['minSleepHR'] = min(sleep_hr)
                    sleep_result['maxSleepHR'] = max(sleep_hr)
        except Exception:
            pass  # HR data not available

        # Try to get SpO2 during sleep
        try:
            spo2_data = client.get_spo2_data(target_date)
            avg_spo2 = spo2_data.get('avgSleepSpO2') or spo2_data.get('averageSpO2')
            if avg_spo2:
                sleep_result['averageSpO2Value'] = avg_spo2
        except Exception:
            pass  # SpO2 data not available

        return {"success": True, "data": sleep_result}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_activity_summary(target_date: str, user_id: str = None) -> dict:
    """Fetch daily activity summary."""
    try:
        client = get_client(user_id)
        data = client.get_user_summary(target_date)
        return {"success": True, "data": depersonalize_activity(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_stress_data(target_date: str, user_id: str = None) -> dict:
    """Fetch stress data."""
    try:
        client = get_client(user_id)
        data = client.get_stress_data(target_date)
        return {"success": True, "data": depersonalize_stress(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_body_battery(target_date: str, user_id: str = None) -> dict:
    """Fetch body battery data."""
    try:
        client = get_client(user_id)
        data = client.get_body_battery(target_date)
        return {"success": True, "data": depersonalize_body_battery(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_heart_rate(target_date: str, user_id: str = None) -> dict:
    """Fetch heart rate data."""
    try:
        client = get_client(user_id)
        data = client.get_heart_rates(target_date)
        return {"success": True, "data": depersonalize_heart_rate(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_activities(target_date: str, user_id: str = None) -> dict:
    """Fetch individual activities for a specific date."""
    try:
        client = get_client(user_id)
        # Get activities for the date range (single day)
        activities = client.get_activities_by_date(target_date, target_date)

        # De-personalize activities
        clean_activities = []
        for act in activities:
            clean_activities.append({
                "activityId": act.get("activityId"),
                "activityName": act.get("activityName"),
                "activityType": act.get("activityType", {}).get("typeKey") if isinstance(act.get("activityType"), dict) else None,
                "startTimeLocal": act.get("startTimeLocal"),
                "duration": act.get("duration"),  # seconds
                "distance": act.get("distance"),  # meters
                "calories": act.get("calories"),
                "averageHR": act.get("averageHR"),
                "maxHR": act.get("maxHR"),
                "averageSpeed": act.get("averageSpeed"),  # m/s
                "elevationGain": act.get("elevationGain"),
                "steps": act.get("steps"),
            })

        return {"success": True, "data": clean_activities}
    except Exception as e:
        return {"success": False, "error": str(e)}


def fetch_activities_batch(start_date: str, end_date: str, user_id: str = None) -> dict:
    """Fetch individual activities for a date range in a single API call."""
    try:
        client = get_client(user_id)
        # Get all activities for the date range
        activities = client.get_activities_by_date(start_date, end_date)

        # Group activities by date
        activities_by_date = {}
        for act in activities:
            # Extract date from startTimeLocal (format: "2024-01-15 08:30:00")
            start_time = act.get("startTimeLocal", "")
            act_date = start_time.split(" ")[0] if start_time else None

            if not act_date:
                continue

            if act_date not in activities_by_date:
                activities_by_date[act_date] = []

            activities_by_date[act_date].append({
                "activityId": act.get("activityId"),
                "activityName": act.get("activityName"),
                "activityType": act.get("activityType", {}).get("typeKey") if isinstance(act.get("activityType"), dict) else None,
                "startTimeLocal": act.get("startTimeLocal"),
                "duration": act.get("duration"),
                "distance": act.get("distance"),
                "calories": act.get("calories"),
                "averageHR": act.get("averageHR"),
                "maxHR": act.get("maxHR"),
                "averageSpeed": act.get("averageSpeed"),
                "elevationGain": act.get("elevationGain"),
                "steps": act.get("steps"),
            })

        return {"success": True, "data": activities_by_date}
    except Exception as e:
        return {"success": False, "error": str(e)}


def sync_all(start_date: str, end_date: str, user_id: str = None) -> dict:
    """Sync all data types for a date range."""
    try:
        client = get_client(user_id)
        results = {
            "success": True,
            "dates": {}
        }

        current = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        while current <= end:
            date_str = current.isoformat()
            day_data = {
                "sleep": None,
                "activity": None,
                "stress": None,
                "bodyBattery": None,
                "heartRate": None
            }

            try:
                sleep_raw = client.get_sleep_data(date_str)
                sleep_result = depersonalize_sleep(sleep_raw)

                # Add HR during sleep
                try:
                    hr_data = client.get_heart_rates(date_str)
                    hr_values = hr_data.get('heartRateValues', [])
                    sleep_start = sleep_result.get('sleepStartTimestampGMT')
                    sleep_end = sleep_result.get('sleepEndTimestampGMT')

                    if hr_values and sleep_start and sleep_end:
                        sleep_hr = [v[1] for v in hr_values if v[0] and sleep_start <= v[0] <= sleep_end and v[1]]
                        if sleep_hr:
                            sleep_result['avgSleepHR'] = round(sum(sleep_hr) / len(sleep_hr))
                except Exception:
                    pass

                # Add SpO2 if available
                try:
                    spo2_data = client.get_spo2_data(date_str)
                    avg_spo2 = spo2_data.get('avgSleepSpO2') or spo2_data.get('averageSpO2')
                    if avg_spo2:
                        sleep_result['averageSpO2Value'] = avg_spo2
                except Exception:
                    pass

                day_data["sleep"] = sleep_result
            except Exception as e:
                day_data["sleepError"] = str(e)

            try:
                activity_raw = client.get_user_summary(date_str)
                day_data["activity"] = depersonalize_activity(activity_raw)
            except Exception as e:
                day_data["activityError"] = str(e)

            try:
                stress_raw = client.get_stress_data(date_str)
                day_data["stress"] = depersonalize_stress(stress_raw)
            except Exception as e:
                day_data["stressError"] = str(e)

            try:
                bb_raw = client.get_body_battery(date_str)
                day_data["bodyBattery"] = depersonalize_body_battery(bb_raw)
            except Exception as e:
                day_data["bodyBatteryError"] = str(e)

            try:
                hr_raw = client.get_heart_rates(date_str)
                day_data["heartRate"] = depersonalize_heart_rate(hr_raw)
            except Exception as e:
                day_data["heartRateError"] = str(e)

            results["dates"][date_str] = day_data
            current += timedelta(days=1)

        return results
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified"}))
        sys.exit(1)

    command = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    user_id = args.get("user_id")

    commands = {
        "authenticate": lambda: authenticate(args.get("email", ""), args.get("password", ""), user_id),
        "check_auth": lambda: check_auth(user_id),
        "fetch_sleep": lambda: fetch_sleep_data(args.get("date", ""), user_id),
        "fetch_activity": lambda: fetch_activity_summary(args.get("date", ""), user_id),
        "fetch_stress": lambda: fetch_stress_data(args.get("date", ""), user_id),
        "fetch_body_battery": lambda: fetch_body_battery(args.get("date", ""), user_id),
        "fetch_heart_rate": lambda: fetch_heart_rate(args.get("date", ""), user_id),
        "fetch_activities": lambda: fetch_activities(args.get("date", ""), user_id),
        "fetch_activities_batch": lambda: fetch_activities_batch(args.get("start_date", ""), args.get("end_date", ""), user_id),
        "sync_all": lambda: sync_all(args.get("start_date", ""), args.get("end_date", ""), user_id),
    }

    if command not in commands:
        print(json.dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)

    result = commands[command]()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
