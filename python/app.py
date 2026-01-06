#!/usr/bin/env python3
"""
Garmin Connect HTTP API service.
Deployed separately (Railway/Render) for hosted mode.
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_service import (
    authenticate,
    check_auth,
    fetch_sleep_data,
    fetch_activity_summary,
    fetch_stress_data,
    fetch_body_battery,
    fetch_heart_rate,
    fetch_activities,
    fetch_activities_batch,
    sync_all,
)

app = Flask(__name__)
CORS(app)

# Simple API key auth for the service
API_KEY = os.environ.get("GARMIN_SERVICE_API_KEY", "")


def check_api_key():
    """Verify API key if configured."""
    if not API_KEY:
        return True
    auth_header = request.headers.get("Authorization", "")
    return auth_header == f"Bearer {API_KEY}"


@app.before_request
def verify_auth():
    if not check_api_key():
        return jsonify({"error": "Unauthorized"}), 401


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/authenticate", methods=["POST"])
def auth_endpoint():
    data = request.json or {}
    result = authenticate(
        data.get("email", ""),
        data.get("password", ""),
        data.get("user_id"),
    )
    return jsonify(result)


@app.route("/check-auth", methods=["POST"])
def check_auth_endpoint():
    data = request.json or {}
    result = check_auth(data.get("user_id"))
    return jsonify(result)


@app.route("/sleep", methods=["POST"])
def sleep_endpoint():
    data = request.json or {}
    result = fetch_sleep_data(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/activity", methods=["POST"])
def activity_endpoint():
    data = request.json or {}
    result = fetch_activity_summary(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/stress", methods=["POST"])
def stress_endpoint():
    data = request.json or {}
    result = fetch_stress_data(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/body-battery", methods=["POST"])
def body_battery_endpoint():
    data = request.json or {}
    result = fetch_body_battery(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/heart-rate", methods=["POST"])
def heart_rate_endpoint():
    data = request.json or {}
    result = fetch_heart_rate(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/activities", methods=["POST"])
def activities_endpoint():
    data = request.json or {}
    result = fetch_activities(data.get("date", ""), data.get("user_id"))
    return jsonify(result)


@app.route("/activities-batch", methods=["POST"])
def activities_batch_endpoint():
    data = request.json or {}
    result = fetch_activities_batch(
        data.get("start_date", ""),
        data.get("end_date", ""),
        data.get("user_id"),
    )
    return jsonify(result)


@app.route("/sync-all", methods=["POST"])
def sync_all_endpoint():
    data = request.json or {}
    result = sync_all(
        data.get("start_date", ""),
        data.get("end_date", ""),
        data.get("user_id"),
    )
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
