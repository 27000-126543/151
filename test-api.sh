#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsInJvbGUiOiJhZG1pbiIsInVzZXJuYW1lIjoidGVzdGFkbWluIiwiaWF0IjoxNzgwODk2NjYxLCJleHAiOjE3ODE1MDE0NjF9.zgLw4VXkfZQNG1gAqS99ht404hoD8tS0vmqXRjwmyuQ"

echo "=== 测试 1: 健康检查 ==="
curl -s http://localhost:3000/health
echo -e "\n"

echo "=== 测试 2: 需求响应详情（不存在的ID，测试404 ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/demand-response/non-existent-id
echo -e "\n"

echo "=== 测试 3: 提交用电计划（测试业务错误） ==="
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST http://localhost:3000/api/electricity-plans -d '{"planDate":"2026-06-08","hourlyDemand":[10,20,30]}'
echo -e "\n"

echo "=== 测试 4: 上报设备数据（测试业务错误） ==="
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST http://localhost:3000/api/devices/data/report -d '{"deviceId":"test-device","timestamp":"2026-06-08T12:00:00Z","powerInput":100,"powerOutput":50,"temperature":45}'
echo -e "\n"

echo "=== 测试 5: 生成日报（测试业务错误） ==="
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST http://localhost:3000/api/daily-reports/generate -d '{"reportDate":"2026-06-07"}'
echo -e "\n"

echo "=== 测试 6: 查询碳报告（测试业务错误） ==="
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST http://localhost:3000/api/carbon/report -d '{"startDate":"2026-06-01","endDate":"2026-06-07"}'
echo -e "\n"

echo "=== 测试 7: 创建工单（测试业务错误） ==="
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST http://localhost:3000/api/work-orders -d '{"title":"测试故障","description":"变压器过载","deviceId":"test-device","faultLevel":"high"}'
echo -e "\n"

echo "=== 测试 8: 设备历史（日期范围查询 ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/devices/test-device-id/history?startDate=2026-06-01&endDate=2026-06-08"
echo -e "\n"

echo "=== 测试 9: 抢修队技能筛选 ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/work-orders/teams?skill=electrical"
echo -e "\n"

echo "=== 所有测试完成 ==="
