# 브리핑 데이터 스키마 (schemaVersion 1)

회차 파일 `data/editions/<id>.json` (id = `YYYY-MM-DD-am` 또는 `YYYY-MM-DD-pm`, 한국 시간 기준 날짜).

```jsonc
{
  "schemaVersion": 1,
  "id": "2026-11-27-am",
  "date": "2026-11-27",                    // KST 날짜
  "slot": "am",                            // am(아침 7시경) | pm(저녁)
  "generatedAt": "2026-11-27T07:15:00+09:00",
  "title": "11월 27일 아침 브리핑",
  "headline": ["핵심 한 줄", "핵심 한 줄", "핵심 한 줄"],   // 3~5개, 각 120자 이하
  "regions": [
    {
      "code": "KR",                        // docs/regions.md 의 코드
      "name": "대한민국", "flag": "🇰🇷",
      "summary": "이 지역의 오늘 분위기를 1~2문장으로",       // 240자 이하
      "items": [
        {
          "id": "kr-1",                    // 회차 안에서 유일, 소문자-숫자
          "topic": "politics",             // politics|economy|society|world|tech|security|energy|climate|health|culture|other
          "title": "한국어 제목",           // 100자 이하
          "summary": "2~4문장 요약. 원문을 복사하지 말고 자신의 말로.",  // 600자 이하
          "whyItMatters": "왜 중요한지 1문장",                          // 200자 이하, 선택
          "importance": 3,                 // 1(참고) 2(주요) 3(핵심)
          "confidence": "high",            // high(2곳 이상 확인) | medium(1곳 또는 발표 직후) | low(미확인·추정 포함)
          "publishedAt": "2026-11-26",     // 사건/기사 날짜(선택)
          "isUpdate": false,               // 이전 회차 이슈의 후속이면 true
          "tags": ["반도체", "관세"],       // 최대 5개, 이슈 추적에 사용
          "sources": [ { "name": "Reuters", "url": "https://…", "lang": "en" } ]   // 1~4개, https 만
        }
      ]
    }
  ],
  "watchlist": [ { "date": "2026-12-01", "title": "다음 주 주목할 일정", "region": "US" } ],   // 선택, 최대 8개
  "notes": "수집 한계·유의점 (선택)"
}
```

규칙
- 지역당 항목 1~6개, 회차당 지역 3~12개, 항목 id 는 회차 안에서 유일.
- 출처 URL 은 `https://` 만, 같은 항목에 같은 URL 중복 금지.
- 텍스트에 HTML 을 넣지 않는다 (앱이 그대로 표시).
- 사실 확인이 안 된 내용은 `confidence: "low"` 로 두고 요약에 "미확인"을 밝힌다. 지어내지 않는다.

`data/index.json`: `{ "schemaVersion": 1, "updatedAt": "…", "latest": "<id>", "editions": [ { "id","date","slot","title","headline":[…],"regions":["KR",…],"itemCount":n,"path":"data/editions/<id>.json" } ] }` (최신순, 자동 생성)
