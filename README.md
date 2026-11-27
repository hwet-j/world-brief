# world-brief

주요 국가의 뉴스·이슈를 **Claude Code 예약 작업**이 수집·요약해 이 저장소의 `data/` 에 올리고,
**앱(`app/`)은 이 JSON 을 읽어서 보여 주기만** 하는 세계 브리핑입니다. 앱은 직접 데이터를 수집하지 않고 API 비용도 쓰지 않습니다.

```
Claude Code 예약 작업 ──(수집·요약·검증)──▶ data/editions/*.json + data/index.json ──(git push)──▶ GitHub
                                                                                     │
                                          앱(app/) ◀──── raw.githubusercontent.com 읽기 ┘  (템플릿만 적용)
```

## 구조
- `data/editions/YYYY-MM-DD-am|pm.json` — 한 번의 브리핑(회차). 스키마: [`docs/schema.md`](docs/schema.md)
- `data/index.json` — 회차 목록(최신순). `scripts/build-index.mjs` 가 자동 생성
- `scripts/validate.mjs` — 회차 파일 검증 (스키마·출처 URL·길이·중복)
- `docs/routine.md` — 예약 작업이 따르는 **수집·요약 절차와 편집 원칙**
- `docs/regions.md` — 지역 목록과 권장 출처
- `app/` — 안드로이드 앱(Expo)

## 데이터 직접 확인
```bash
node scripts/validate.mjs        # 모든 회차 검증
node scripts/build-index.mjs     # data/index.json 재생성
npm test                         # 스크립트 테스트
```
앱이 읽는 주소: `https://raw.githubusercontent.com/hwet-j/world-brief/main/data/index.json`
