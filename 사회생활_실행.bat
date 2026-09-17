@echo off
chcp 65001 > nul
title 봇치의 사회생활 서바이벌 (RPG) - 실행기
cd /d "%~dp0"

echo ========================================================
echo        봇치의 사회생활 서바이벌 (RPG)
echo        BOCCHI'S SOCIAL SURVIVAL RPG PROTOTYPE
echo ========================================================
echo.
echo  로컬 웹 서버를 구동하고 있습니다...
echo  브라우저에서 아래 주소로 접속하실 수 있습니다:
echo  ▶ http://localhost:3000/survival.html
echo.
echo  * 게임을 종료하시려면 이 콘솔 창을 닫아주세요.
echo ========================================================
echo.

start "" http://localhost:3000/survival.html
call npm run dev

pause
