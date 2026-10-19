@echo off
title HUIT AI Command Center Server
echo ===================================================
echo   STARTING AI CUSTOMER STRATEGY...
echo ===================================================

:: Kich hoat moi truong ao Python
call venv\Scripts\activate

:: Tu dong mo trinh duyet vao trang web sau 2 giay
start "" http://127.0.0.1:8000

:: Chay server FastAPI
uvicorn app:app --reload

pause