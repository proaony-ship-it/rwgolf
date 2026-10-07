@echo off
chcp 65001 >nul
title ระบบแข่งขันกอล์ฟ ชมรมกอล์ฟราชวิทย์
cd /d "%~dp0"
if not exist node_modules ( echo ติดตั้งครั้งแรก กรุณารอสักครู่... && call npm install )
start "" http://localhost:3000
node server.js
pause
