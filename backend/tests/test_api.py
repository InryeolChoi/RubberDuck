"""API 엔드포인트 통합 테스트 (Azure PostgreSQL에 연결).

생성한 데이터는 각 테스트 끝에서 정리한다.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_task_crud_and_quadrant() -> None:
    # 생성 (importance>=3 & urgency>=3 → Q1)
    res = client.post(
        "/api/tasks",
        json={"title": "테스트 할 일", "importance": 4, "urgency": 4, "tags": ["key"]},
    )
    assert res.status_code == 201
    task = res.json()
    task_id = task["id"]
    assert task["quadrant"] == "Q1"
    assert task["status"] == "todo"
    assert task["tags"] == ["key"]

    try:
        # 단건 조회
        res = client.get(f"/api/tasks/{task_id}")
        assert res.status_code == 200

        # 목록 + 사분면 필터
        res = client.get("/api/tasks", params={"quadrant": "Q1"})
        assert res.status_code == 200
        assert any(t["id"] == task_id for t in res.json())

        # 수정: 사분면 이동(Q1→Q4) + 완료
        res = client.patch(
            f"/api/tasks/{task_id}",
            json={"importance": 1, "urgency": 1, "status": "done"},
        )
        assert res.status_code == 200
        updated = res.json()
        assert updated["quadrant"] == "Q4"
        assert updated["status"] == "done"
        assert updated["completed_at"] is not None
    finally:
        # 삭제
        res = client.delete(f"/api/tasks/{task_id}")
        assert res.status_code == 204
        assert client.get(f"/api/tasks/{task_id}").status_code == 404


def test_task_validation() -> None:
    res = client.post(
        "/api/tasks",
        json={"title": "잘못된 값", "importance": 9, "urgency": 1},
    )
    assert res.status_code == 422


def test_checkin_and_trends_and_fixed() -> None:
    # 고정값 갱신(PUT, 없으면 생성)
    res = client.put(
        "/api/context/fixed",
        json={"job": "사무직", "commute_status": "hybrid", "base_stamina": 3},
    )
    assert res.status_code == 200
    assert res.json()["commute_status"] == "hybrid"

    # 고정값 조회
    assert client.get("/api/context/fixed").status_code == 200

    # 체크인 기록
    res = client.post(
        "/api/context/checkins",
        json={"mood": 3, "energy_level": 2, "sleep_hours": 6.5},
    )
    assert res.status_code == 201

    # 최신 체크인
    res = client.get("/api/context/checkins/latest")
    assert res.status_code == 200
    assert res.json()["mood"] == 3

    # 추세
    res = client.get("/api/context/trends", params={"metric": "mood", "bucket": "day"})
    assert res.status_code == 200
    body = res.json()
    assert body["metric"] == "mood"
    assert isinstance(body["points"], list)

    # 잘못된 metric
    assert (
        client.get("/api/context/trends", params={"metric": "hacker"}).status_code
        == 400
    )


def test_duck_react_placeholder() -> None:
    res = client.post("/api/duck/react", json={"note": "막막해"})
    assert res.status_code == 200
    body = res.json()
    assert "message" in body
    assert body["source"] in {"fallback", "copilot-sdk", "azure-openai"}


def test_task_parse_returns_draft() -> None:
    # LLM 미설정 환경에서도 폴백 초안을 반환해야 한다.
    res = client.post("/api/tasks/parse", json={"text": "내일까지 보고서 마무리, 급함"})
    assert res.status_code == 200
    body = res.json()
    draft = body["draft"]
    assert isinstance(draft["title"], str) and draft["title"]
    assert 1 <= draft["importance"] <= 5
    assert 1 <= draft["urgency"] <= 5
    assert isinstance(draft["tags"], list)
    assert body["source"] in {"fallback", "copilot-sdk", "azure-openai"}


def test_task_parse_validation() -> None:
    # 빈 문자열은 거부(min_length=1)
    assert client.post("/api/tasks/parse", json={"text": ""}).status_code == 422


def test_trend_insight() -> None:
    # 체크인 1건 기록 후 인사이트 요청 → 요약 문자열 + source 반환
    client.post("/api/context/checkins", json={"energy_level": 3})
    res = client.get(
        "/api/context/trends/insight",
        params={"metric": "energy_level", "bucket": "day"},
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["summary"], str) and body["summary"]
    assert body["source"] in {"fallback", "copilot-sdk", "azure-openai"}
    assert isinstance(body["points"], list)

    # 잘못된 metric은 400
    assert (
        client.get(
            "/api/context/trends/insight", params={"metric": "hacker"}
        ).status_code
        == 400
    )


def test_weather_manual_and_latest() -> None:
    # 수동 저장(외부 호출 없이)
    res = client.post(
        "/api/context/weather/manual",
        json={"temperature_c": 31.0, "humidity_pct": 78, "condition": "흐림"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["temperature_c"] == 31.0
    assert body["humidity_pct"] == 78

    # 최신 날씨
    res = client.get("/api/context/weather/latest")
    assert res.status_code == 200
    assert res.json()["condition"] == "흐림"


def test_recommendations_with_weather_and_duck() -> None:
    # 무더위 맥락 + 에너지 낮음
    client.post(
        "/api/context/weather/manual",
        json={"temperature_c": 32.0, "humidity_pct": 80, "condition": "흐림"},
    )
    client.post(
        "/api/context/checkins",
        json={"energy_level": 1, "available_minutes": 20},
    )

    # 짧은 일(quick) vs 무거운 일(heavy)
    quick = client.post(
        "/api/tasks",
        json={
            "title": "빠른 메일 회신",
            "importance": 2,
            "urgency": 4,
            "estimated_minutes": 10,
            "tags": ["quick"],
        },
    ).json()
    heavy = client.post(
        "/api/tasks",
        json={
            "title": "분기 보고서 작성",
            "importance": 5,
            "urgency": 3,
            "estimated_minutes": 180,
        },
    ).json()

    try:
        res = client.get("/api/recommendations", params={"limit": 10})
        assert res.status_code == 200
        body = res.json()
        assert body["duck"] is not None
        assert body["context"]["temperature_c"] == 32.0
        ids = [item["id"] for item in body["items"]]
        assert quick["id"] in ids
        assert heavy["id"] in ids

        scores = {item["id"]: item["score"] for item in body["items"]}
        # 에너지 낮음 + 무더위 + 가용 20분 → 짧은 일이 무거운 일보다 우선
        assert scores[quick["id"]] > scores[heavy["id"]]

        quick_item = next(i for i in body["items"] if i["id"] == quick["id"])
        assert any("무더위" in r or "짧은 일" in r for r in quick_item["reasons"])

        # duck 엔드포인트도 동일 구조
        res2 = client.get("/api/duck/recommend")
        assert res2.status_code == 200
        assert res2.json()["duck"]["message"]
    finally:
        client.delete(f"/api/tasks/{quick['id']}")
        client.delete(f"/api/tasks/{heavy['id']}")

