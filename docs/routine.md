# 예약 작업(Claude Code) 요약 절차

**역할 분담**
- 깃허브 액션(`fetch-edition.yml`)이 인터넷에서 한국·미국 공개 RSS 를 모아 `data/raw/<id>.json`(원본 기사 목록)을 올린다. 매일 KST 06:10 · 18:10.
- **이 예약 세션은 뉴스 사이트에 접속하지 않는다.** 저장소에 올라온 원본을 읽어 한국어로 요약한 회차(`data/editions/<id>.json`)를 만들어 올린다. 매일 KST 06:35 · 18:35.
- 앱은 API 를 쓰지 않고 `data/editions` 와 `data/index.json` 만 읽는다.
- 07:00 · 19:00 까지 요약본이 없으면 액션이 원본의 제목·소개문만으로 대신 회차를 만든다(이미 요약본이 있으면 건드리지 않음).

## 절차
1. **저장소 준비**: `add_repo`(hwet-j/world-brief, access=push) → 안내된 대로 `git clone https://github.com/hwet-j/world-brief /home/user/world-brief` → `register_repo_root`. git: `user.name "정회창"`, `user.email "81364742+hwet-j@users.noreply.github.com"`. **커밋 메시지에 Claude/Co-Authored-By/세션 문구를 넣지 않는다.** `git pull origin main` 으로 최신 원본을 받는다.
2. **회차 결정**: 한국 시간(KST, UTC+9) 기준 12시 이전이면 `am`, 이후면 `pm`. id = `YYYY-MM-DD-am|pm`. `data/raw/<id>.json` 이 없으면 아직 수집 전이다 → 5분 간격으로 최대 3번 `git pull` 후에도 없으면 파일을 만들지 말고 보고하고 종료한다. 이미 `data/editions/<id>.json` 이 있으면 **덮어쓰지 말고** 종료한다(단, 제목만 있는 대체 회차(`notes` 에 "제목만"/"자동 수집한 RSS 헤드라인")는 요약본으로 교체해도 된다).
3. **후보 추리기**: `node scripts/candidates.mjs <id> --out /tmp/cands.json` — 여러 출처가 함께 다룬 기사, 최신, 소개문이 있는 기사를 우선해 분야별(정치·경제·IT·사회·국제)로 한국·미국 후보를 번호(KR0…, US0…)와 함께 출력한다.
4. **요약**(한국어): 후보 소개문에 **있는 사실만** 쓴다. 지어내거나 소개문에 없는 숫자·인물·인과를 덧붙이지 않는다. 소개문이 비었거나 부족하면 제목에서 확실한 것만 쓰고 항목을 줄인다.
   - 한국·미국 각 12~16개. 같은 사건을 다룬 후보는 `refs` 로 묶어 한 항목으로(출처가 서로 다른 2곳 이상이면 자동으로 confidence high). 다른 나라 후보는 쓰지 않는다. 정치·경제·IT·사회·국제를 골고루, 중요도 순.
   - 영어 기사는 한국어로 번역·요약. 요약은 2~4문장, 원문 문장을 그대로 복사하지 않는다. 핵심 항목(importance 3)에는 `whyItMatters` 한 문장.
   - 정치적으로 갈리는 사안은 각 입장을 균형 있게, 평가어("충격적", "참담")를 피한다. 이전 회차와 같은 이슈는 새 진전이 있을 때만(`isUpdate: true`).
   - `headline` 3~5줄(한국·미국 합쳐 가장 중요한 순, 앞에 🇰🇷/🇺🇸), 지역 `summary` 1~2문장, 필요하면 `watchlist`(확실한 일정만), `notes` 한 줄.
5. **조립·검증**: 요약을 `/tmp/picks.json` 으로 저장(형식은 `scripts/compose.mjs` 머리 주석) → `node scripts/compose.mjs /tmp/cands.json /tmp/picks.json` → `node scripts/build-index.mjs` → `node scripts/validate.mjs` 통과 확인.
6. **게시**: `git add data && git commit -m "data: <YYYY-MM-DD> <am|pm> 브리핑"` → `git push origin main` (거부되면 `git pull --rebase origin main` 후 다시). 앱은 push 즉시 새 데이터를 읽는다.
7. **보고**: 한 줄(회차 id, 지역·항목 수, 문제 있었던 점).

## 편집 원칙
- 목적: 바쁜 사람이 5분 안에 한국과 미국의 큰 흐름(정치·경제·IT)을 파악하도록 돕는 것. 사실 > 맥락 > 전망 순서, 전망은 "…할 수 있다".
- 개인 비방·미확인 의혹·선정적 사건 사고 세부는 다루지 않는다. 의료·투자 조언을 하지 않는다.
- 저작권: 기사 본문을 옮기지 않는다. 핵심 사실을 재서술하고 출처 링크로 연결한다.
- 시각 표기는 KST. 외국 시각은 "현지 시각"을 명시.

## 실패했을 때
원본이 없거나 검증이 끝내 실패하면 파일을 만들지 말고(깨진 데이터를 올리지 않는다) 원인을 보고하고 종료한다. 앱은 마지막 정상 회차를 계속 보여 준다.
