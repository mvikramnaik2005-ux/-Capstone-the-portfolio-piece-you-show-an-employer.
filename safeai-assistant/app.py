"""Streamlit Dashboard for SafeAI – Guardrailed AI Assistant."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import streamlit as st

from assistant import SafeAIAssistant
from cost_tracker import CostTracker, DEFAULT_MODEL_PRICING
from evaluator import (
    DEFAULT_CSV_REPORT_PATH,
    DEFAULT_RESULTS_PATH,
    compute_metrics,
    load_test_cases,
    run_evaluation,
)
from guardrails import SUPPORTED_TOPICS, run_input_guardrails

st.set_page_config(
    page_title="SafeAI – Guardrailed AI Assistant",
    page_icon="🛡️",
    layout="wide",
)

if "cost_tracker" not in st.session_state:
    st.session_state.cost_tracker = CostTracker()

if "assistant" not in st.session_state:
    st.session_state.assistant = SafeAIAssistant(cost_tracker=st.session_state.cost_tracker)

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

if "safety_logs" not in st.session_state:
    st.session_state.safety_logs = []

if "eval_payload" not in st.session_state:
    if Path(DEFAULT_RESULTS_PATH).exists():
        with open(DEFAULT_RESULTS_PATH, "r", encoding="utf-8") as f:
            st.session_state.eval_payload = json.load(f)
    else:
        st.session_state.eval_payload = None

assistant: SafeAIAssistant = st.session_state.assistant
tracker: CostTracker = st.session_state.cost_tracker

with st.sidebar:
    st.title("SafeAI Console")
    st.caption("Programming & AI Learning Assistant")
    page = st.radio(
        "Navigation",
        [
            "Chat Assistant",
            "Safety and Guardrails",
            "Evaluation Dashboard",
            "Token Usage Dashboard",
            "Evaluation Report",
        ],
    )
    st.divider()
    st.subheader("Supported Topics")
    for topic in SUPPORTED_TOPICS:
        st.markdown(f"- {topic}")

    st.divider()
    st.subheader("Model Pricing (USD / 1M)")
    preset = DEFAULT_MODEL_PRICING.get(assistant.model, {"input_per_1m": 0.15, "output_per_1m": 0.60})
    in_price = st.number_input(
        "Input Price ($ / 1M tokens)",
        min_value=0.0,
        value=float(tracker.input_price_per_1m or preset["input_per_1m"]),
        step=0.05,
        format="%.4f",
    )
    out_price = st.number_input(
        "Output Price ($ / 1M tokens)",
        min_value=0.0,
        value=float(tracker.output_price_per_1m or preset["output_per_1m"]),
        step=0.05,
        format="%.4f",
    )
    tracker.configure_pricing(in_price, out_price)

if page == "Chat Assistant":
    st.header("1. Guardrailed Chat Assistant")
    st.write("Ask questions strictly within Programming (Python, C, Java, SQL, DSA) and AI/ML.")

    col_reset, _ = st.columns([1, 5])
    if col_reset.button("Clear Chat History"):
        st.session_state.chat_history = []
        st.rerun()

    for entry in st.session_state.chat_history:
        with st.chat_message("user"):
            st.write(entry["user_input"])
        with st.chat_message("assistant"):
            resp = entry["response"]
            if resp["allowed"]:
                st.success(f"{resp['category']} · {resp['safety_status']} · Confidence {resp['confidence']:.2f}")
            else:
                st.warning(f"{resp['category']} · {resp['safety_status']} · Confidence {resp['confidence']:.2f}")
            st.write(resp["answer"])
            with st.expander("Structured Response Payload & Usage"):
                st.json(resp)
                st.caption(
                    f"Input: {entry['input_tokens']} · Output: {entry['output_tokens']} · "
                    f"Total: {entry['total_tokens']} · Est. Cost: ${entry['estimated_cost_usd']:.6f}"
                )

    prompt = st.chat_input("Ask a Programming or AI question...")
    if prompt is not None:
        result = assistant.ask(prompt, source="chat")
        resp_dict = result.response.model_dump()
        st.session_state.chat_history.append(
            {
                "user_input": prompt,
                "response": resp_dict,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "total_tokens": result.total_tokens,
                "estimated_cost_usd": result.estimated_cost_usd,
            }
        )
        st.session_state.safety_logs.insert(
            0,
            {
                "input_preview": prompt[:90],
                "category": resp_dict["category"],
                "allowed": resp_dict["allowed"],
                "safety_status": resp_dict["safety_status"],
                "refusal_reason": resp_dict["refusal_reason"] or "—",
                "stage": result.guardrail_stage,
            },
        )
        st.rerun()

elif page == "Safety and Guardrails":
    st.header("2. Safety and Guardrails")
    st.info(
        "SafeAI uses multi-layered guardrails (input validation, prompt-injection defense, "
        "unsafe-request detection, domain classification, and Pydantic output validation). "
        "No guardrail system is 100% infallible against novel adversarial inputs."
    )

    probe_text = st.text_area("Test an input against Layer 1 & Layer 2 Guardrails:", height=100)
    if st.button("Run Guardrail Check"):
        precheck = run_input_guardrails(probe_text)
        if not precheck.passed_precheck and precheck.blocked_response is not None:
            st.error(f"Blocked at Layer 1 ({precheck.matched_rule})")
            st.json(precheck.blocked_response.model_dump())
        else:
            st.success("Passed Layer 1 deterministic checks. Running full assistant pipeline...")
            full_res = assistant.ask(probe_text, source="guardrail_probe")
            st.json(full_res.response.model_dump())

    st.subheader("Recent Safety Decisions")
    if st.session_state.safety_logs:
        st.dataframe(pd.DataFrame(st.session_state.safety_logs), use_container_width=True)
    else:
        st.caption("No safety decisions recorded in this session yet.")

elif page == "Evaluation Dashboard":
    st.header("3. Evaluation Dashboard")
    if st.button("Run Live Evaluation Suite", type="primary"):
        with st.spinner("Running evaluation test cases..."):
            eval_out = run_evaluation(assistant=assistant)
            st.session_state.eval_payload = eval_out
            st.success("Evaluation completed and reports updated.")

    payload = st.session_state.eval_payload
    if payload:
        metrics = payload.get("metrics") or compute_metrics(payload.get("results", []))
        c1, c2, c3 = st.columns(3)
        c1.metric("Total Test Cases", metrics["total_test_cases"])
        c2.metric("Passed", metrics["passed_test_cases"])
        c3.metric("Failed", metrics["failed_test_cases"])

        c4, c5, c6 = st.columns(3)
        c4.metric("Accuracy (%)", f"{metrics['accuracy_percentage']:.1f}%")
        c5.metric("Off-Topic Rejection (%)", f"{metrics['off_topic_rejection_rate']:.1f}%")
        c6.metric("Unsafe Rejection (%)", f"{metrics['unsafe_request_rejection_rate']:.1f}%")

        df = pd.DataFrame(payload.get("results", []))
        st.dataframe(df, use_container_width=True)
    else:
        st.caption("Showing raw evaluation dataset (no results file found yet).")
        st.dataframe(pd.DataFrame(load_test_cases()), use_container_width=True)

elif page == "Token Usage Dashboard":
    st.header("4. Token Usage & Cost Tracking")
    summary = tracker.summary()

    st.warning(
        "Estimated Cost vs. Actual Billed Cost: Figures below are locally estimated from "
        "recorded API token counts and configurable per-1M token rates. Refer to your "
        "OpenAI billing console for official invoiced charges."
    )

    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("API Calls", summary["api_calls"])
    m2.metric("Input Tokens", f"{summary['input_tokens']:,}")
    m3.metric("Output Tokens", f"{summary['output_tokens']:,}")
    m4.metric("Total Tokens", f"{summary['total_tokens']:,}")
    m5.metric("Estimated Cost (USD)", f"${summary['estimated_cost_usd']:.6f}")

    if tracker.events:
        events_df = pd.DataFrame([event.__dict__ for event in tracker.events])
        st.dataframe(events_df, use_container_width=True)
    else:
        st.caption("No live API calls recorded in this session yet.")

elif page == "Evaluation Report":
    st.header("5. Evaluation Report Export")
    if Path(DEFAULT_CSV_REPORT_PATH).exists():
        csv_bytes = Path(DEFAULT_CSV_REPORT_PATH).read_bytes()
        st.download_button(
            label="Download evaluation_report.csv",
            data=csv_bytes,
            file_name="evaluation_report.csv",
            mime="text/csv",
        )
        st.dataframe(pd.read_csv(DEFAULT_CSV_REPORT_PATH), use_container_width=True)
    else:
        st.info("Run the Evaluation Dashboard suite to generate evaluation_report.csv.")
