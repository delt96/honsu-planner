# honsu-planner

혼수 목록 & 예산 (Phase 1).

## 실행
1. PostgreSQL DB 생성 후 `.env` 작성 (`.env.example` 참고)
2. `npm install`
3. `npm run migrate`
4. `cd web && npm install && npm run build && cd ..`
5. `npm start` → http://localhost:3000

## 개발
- 서버: `npm run dev`
- 프론트(별도 터미널): `cd web && npm run dev` (Vite dev, /api는 :3000으로 프록시)

## 테스트
- 서버: `npm test`
- 프론트: `cd web && npm test`
