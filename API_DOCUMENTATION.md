# 城市智慧电力能源调度与需求响应系统 API文档

## 目录

1. [系统概述](#系统概述)
2. [技术栈](#技术栈)
3. [用户角色与权限](#用户角色与权限)
4. [快速开始](#快速开始)
5. [API模块总览](#api模块总览)
6. [通用响应格式](#通用响应格式)
7. [认证与授权](#认证与授权)
8. [API详细说明](#api详细说明)
   - [用电计划推荐模块](#1-用电计划推荐模块)
   - [分布式能源设备模块](#2-分布式能源设备模块)
   - [需求响应模块](#3-需求响应模块)
   - [电力交易模块](#4-电力交易模块)
   - [工单管理模块](#5-工单管理模块)
   - [电费结算模块](#6-电费结算模块)
   - [碳排放核算模块](#7-碳排放核算模块)
   - [能源运营日报模块](#8-能源运营日报模块)
9. [实时消息推送](#实时消息推送)
10. [定时任务](#定时任务)
11. [错误码说明](#错误码说明)

---

## 系统概述

本系统是一个完整的城市智慧电力能源调度与需求响应平台，涵盖9大核心功能模块，实现从用电计划推荐、分布式能源管理、需求响应、电力交易、设备监控、电费结算、碳排放核算到运营日报的全流程数字化管理。

### 核心功能

1. **用电计划推荐**：基于实时电价、负荷预测和历史数据，为用户/企业提供三种策略（成本最优、综合平衡、环保优先）的最优用电时段推荐
2. **分布式能源设备管理**：光伏、储能设备实时数据上报，异常检测，供需平衡计算，调度指令生成
3. **需求响应管理**：电网需求响应指令发布，用户智能匹配，任务分配，激励自动核算发放
4. **电力交易**：次日负荷预测购售电策略生成，交易员审批流程，成交跟踪，合同管理
5. **设备监控与工单**：设备故障检测，抢修工单自动生成，智能分配（技能/距离/负载），30天重复故障高风险标记
6. **电费结算**：分时电价核算，月度账单自动生成，逾期催收，欠费30天限电
7. **碳排放核算**：基于能源结构的碳排量计算，碳积分发放，碳报告导出，碳积分交易
8. **能源运营日报**：每日凌晨自动生成30+项指标统计，支持按区域/日期导出
9. **实时消息推送**：告警、调度指令、交易结果、账单信息实时推送给相关角色

---

## 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Node.js | >=16.x | JavaScript运行环境 |
| 编程语言 | TypeScript | ^5.0 | 类型安全的JavaScript超集 |
| Web框架 | Express | ^4.18 | 轻量级Web框架 |
| ORM | TypeORM | ^0.3 | 类型安全的ORM框架 |
| 数据库 | PostgreSQL | >=13 | 关系型数据库 |
| 认证 | jsonwebtoken | ^9.0 | JWT Token认证 |
| 实时通信 | Socket.io | ^4.7 | WebSocket实时推送 |
| 定时任务 | node-cron | ^3.0 | Cron定时任务调度 |
| 数据验证 | Joi | ^17.11 | 请求参数验证 |
| 日志 | Winston | ^3.11 | 分级日志系统 |
| Excel导出 | ExcelJS | ^4.4 | Excel报表生成 |
| 日期处理 | Moment.js | ^2.29 | 日期时间处理 |

---

## 用户角色与权限

系统支持7种用户角色，通过RBAC实现细粒度权限控制：

| 角色 | 代码 | 权限说明 |
|------|------|----------|
| 管理员 | `admin` | 系统所有权限，审批交易，用户管理 |
| 普通用户 | `user` | 居民用户，提交用电计划，查看账单、碳积分 |
| 企业用户 | `enterprise` | 企业用户，大用电客户，需求响应参与 |
| 交易员 | `trader` | 电力交易策略生成、交易执行、合同管理 |
| 运营人员 | `operator` | 设备监控、告警处理、运营数据查看 |
| 运维人员 | `maintenance` | 抢修工单接收、处理、完工上报 |
| 催收人员 | `collector` | 逾期账单催收、限电执行 |

---

## 快速开始

### 1. 环境配置

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=smart_power

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 服务配置
PORT=3000
NODE_ENV=development

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379

# SMTP配置（可选）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

### 2. 安装依赖

```bash
npm install
```

### 3. 数据库初始化

```bash
# 创建数据库迁移
npm run typeorm migration:generate -- -n InitialMigration

# 执行迁移
npm run typeorm migration:run

# （可选）填充测试数据
npm run seed
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

### 5. 健康检查

访问 `http://localhost:3000/health`，应返回：

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456
}
```

---

## API模块总览

| 模块 | 基础路径 | 主要功能 |
|------|----------|----------|
| 用电计划推荐 | `/api/electricity-plans` | 提交计划、获取推荐、选择方案 |
| 分布式能源设备 | `/api/devices` | 数据上报、设备管理、告警查询 |
| 需求响应 | `/api/demand-response` | 发布响应、任务分配、激励核算 |
| 电力交易 | `/api/power-trades` | 策略生成、审批、交易、结算 |
| 工单管理 | `/api/work-orders` | 工单生成、分配、处理、验收 |
| 电费结算 | `/api/billing` | 账单生成、支付、催收、限电 |
| 碳排放核算 | `/api/carbon` | 排放计算、碳积分、报告导出 |
| 能源运营日报 | `/api/daily-reports` | 日报生成、查询、导出 |

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    // 业务数据
  }
}
```

### 分页响应

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

---

## 认证与授权

### 登录获取Token

**POST** `/api/auth/login`

请求体：
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "user@example.com",
      "role": "user",
      "realName": "张三"
    }
  }
}
```

### 使用Token

在请求头中添加：

```
Authorization: Bearer <your_token>
```

---

## API详细说明

### 1. 用电计划推荐模块

#### 1.1 提交用电计划

**POST** `/api/electricity-plans`

**权限**：`user`, `enterprise`

请求体：
```json
{
  "planName": "1月份生产用电计划",
  "totalDemand": 5000,
  "hourlyDemand": [100, 80, 60, 50, 40, 30, 50, 120, 200, 350, 400, 380, 300, 320, 350, 380, 400, 420, 450, 400, 300, 200, 150, 100],
  "preferredStrategy": "cost_optimal",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "description": "生产线用电需求"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| planName | string | 是 | 计划名称 |
| totalDemand | number | 是 | 总用电需求(kWh) |
| hourlyDemand | number[] | 是 | 24小时用电需求数组 |
| preferredStrategy | string | 否 | 偏好策略：cost_optimal/balanced/environmental |
| startDate | date | 是 | 计划开始日期 |
| endDate | date | 是 | 计划结束日期 |

响应：返回用电计划ID和3种推荐方案

#### 1.2 获取我的用电计划

**GET** `/api/electricity-plans?page=1&pageSize=10`

**权限**：`user`, `enterprise`

查询参数：
- `page`: 页码，默认1
- `pageSize`: 每页条数，默认10
- `status`: 状态筛选（可选）

#### 1.3 获取计划详情

**GET** `/api/electricity-plans/:id`

**权限**：`user`, `enterprise`

返回包含推荐方案的详细信息

#### 1.4 选择推荐方案

**POST** `/api/electricity-plans/:id/select`

**权限**：`user`, `enterprise`

请求体：
```json
{
  "recommendedPlanId": "uuid"
}
```

---

### 2. 分布式能源设备模块

#### 2.1 设备数据上报

**POST** `/api/devices/data`

**权限**：所有已认证用户（设备使用API Key）

请求体：
```json
{
  "deviceId": "device-uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "powerInput": 0,
  "powerOutput": 5.5,
  "voltage": 220.5,
  "current": 25.0,
  "temperature": 45.2,
  "soc": 85.5,
  "frequency": 50.02,
  "status": "normal"
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| deviceId | string | 设备ID |
| timestamp | date | 数据时间戳 |
| powerInput | number | 输入功率(kW) |
| powerOutput | number | 输出功率(kW) |
| voltage | number | 电压(V) |
| current | number | 电流(A) |
| temperature | number | 温度(°C) |
| soc | number | 电池SOC(%) |
| frequency | number | 频率(Hz) |
| status | string | 设备状态 |

#### 2.2 获取设备列表

**GET** `/api/devices?page=1&pageSize=20`

**权限**：`operator`, `admin`

#### 2.3 获取设备详情

**GET** `/api/devices/:id`

#### 2.4 获取设备历史数据

**GET** `/api/devices/:id/data?startDate=2024-01-01&endDate=2024-01-15`

#### 2.5 获取告警列表

**GET** `/api/devices/alerts?page=1&pageSize=20`

**权限**：`operator`, `admin`

#### 2.6 处理告警

**POST** `/api/devices/alerts/:id/handle`

**权限**：`operator`, `admin`

请求体：
```json
{
  "status": "resolved",
  "resolution": "已更换故障部件"
}
```

---

### 3. 需求响应模块

#### 3.1 发布需求响应

**POST** `/api/demand-response`

**权限**：`admin`, `operator`

请求体：
```json
{
  "eventName": "夏季高峰负荷响应",
  "eventType": "peak_shaving",
  "startTime": "2024-07-15T14:00:00Z",
  "endTime": "2024-07-15T17:00:00Z",
  "targetLoadReduction": 5000,
  "incentivePrice": 1.5,
  "region": "朝阳区",
  "description": "下午高峰时段削峰需求"
}
```

#### 3.2 获取需求响应事件列表

**GET** `/api/demand-response?page=1&pageSize=20`

**权限**：所有已认证用户

#### 3.3 获取响应任务

**GET** `/api/demand-response/tasks/my`

**权限**：`user`, `enterprise`

#### 3.4 接受响应任务

**POST** `/api/demand-response/tasks/:id/accept`

**权限**：`user`, `enterprise`

#### 3.5 完成响应任务

**POST** `/api/demand-response/tasks/:id/complete`

**权限**：`user`, `enterprise`

请求体：
```json
{
  "actualLoadReduction": 150,
  "meterData": {}
}
```

#### 3.6 结算需求响应

**POST** `/api/demand-response/:id/settle`

**权限**：`admin`, `operator`

---

### 4. 电力交易模块

#### 4.1 生成交易策略

**POST** `/api/power-trades/strategy`

**权限**：`trader`, `admin`

请求体：
```json
{
  "deliveryDate": "2024-01-16",
  "region": "朝阳区"
}
```

返回：包含24小时分析、推荐交易的完整策略

#### 4.2 创建交易

**POST** `/api/power-trades`

**权限**：`trader`, `admin`

请求体：
```json
{
  "tradeType": "buy",
  "quantity": 1000,
  "bidPrice": 0.52,
  "deliveryDate": "2024-01-16",
  "region": "朝阳区",
  "strategy": "高峰时段补购",
  "hourlyBreakdown": [
    {"hour": 14, "quantity": 500, "price": 0.55},
    {"hour": 15, "quantity": 500, "price": 0.49}
  ]
}
```

#### 4.3 提交审批

**POST** `/api/power-trades/submit-approval`

**权限**：`trader`

请求体：
```json
{
  "tradeId": "trade-uuid"
}
```

#### 4.4 审批通过

**POST** `/api/power-trades/:id/approve`

**权限**：`admin`

请求体：
```json
{
  "approvalRemark": "同意该交易方案"
}
```

#### 4.5 审批驳回

**POST** `/api/power-trades/:id/reject`

**权限**：`admin`

请求体：
```json
{
  "approvalRemark": "价格偏高，建议重新评估"
}
```

#### 4.6 提交交易

**POST** `/api/power-trades/:id/submit`

**权限**：`trader`

#### 4.7 结算交易

**POST** `/api/power-trades/:id/settle`

**权限**：`trader`

#### 4.8 获取交易列表

**GET** `/api/power-trades?page=1&pageSize=20&status=fully_filled`

**权限**：`trader`, `admin`

#### 4.9 获取我的交易

**GET** `/api/power-trades/my`

**权限**：`trader`

---

### 5. 工单管理模块

#### 5.1 根据告警创建工单

**POST** `/api/work-orders/from-alert`

**权限**：`operator`, `admin`

请求体：
```json
{
  "alertId": "alert-uuid"
}
```

#### 5.2 手动创建工单

**POST** `/api/work-orders`

**权限**：`operator`, `admin`

请求体：
```json
{
  "title": "变压器检修",
  "description": "1号变压器异常发热，需要检修",
  "faultLevel": "major",
  "deviceId": "device-uuid",
  "requiredSkill": "transformer",
  "region": "朝阳区",
  "location": "XX变电站",
  "latitude": 39.9042,
  "longitude": 116.4074
}
```

#### 5.3 派单

**POST** `/api/work-orders/:id/dispatch`

**权限**：`operator`, `admin`

#### 5.4 开始抢修

**POST** `/api/work-orders/:id/start`

**权限**：`maintenance`, `admin`

#### 5.5 完成抢修

**POST** `/api/work-orders/:id/complete`

**权限**：`maintenance`, `admin`

请求体：
```json
{
  "repairContent": "更换了冷却风扇和温度传感器",
  "partsReplaced": "冷却风扇x1, 温度传感器x1",
  "repairCost": 2500,
  "beforeImages": ["url1", "url2"],
  "afterImages": ["url3", "url4"]
}
```

#### 5.6 验收

**POST** `/api/work-orders/:id/verify`

**权限**：`operator`, `admin`

请求体：
```json
{
  "passed": true
}
```

#### 5.7 关闭工单

**POST** `/api/work-orders/:id/close`

**权限**：`operator`, `admin`

#### 5.8 获取工单列表

**GET** `/api/work-orders?page=1&pageSize=20&status=in_progress`

**权限**：`operator`, `maintenance`, `admin`

#### 5.9 获取抢修队列表

**GET** `/api/work-orders/teams?status=idle`

**权限**：`operator`, `admin`

---

### 6. 电费结算模块

#### 6.1 生成月度账单

**POST** `/api/billing/generate`

**权限**：`admin`

请求体：
```json
{
  "year": 2024,
  "month": 1
}
```

#### 6.2 发布账单

**POST** `/api/billing/:id/issue`

**权限**：`admin`

#### 6.3 支付账单

**POST** `/api/billing/:id/pay`

**权限**：所有已认证用户

请求体：
```json
{
  "amount": 1250.50
}
```

#### 6.4 检查逾期账单

**POST** `/api/billing/check-overdue`

**权限**：`admin`, `collector`

#### 6.5 发布限电指令

**POST** `/api/billing/limit-orders/:id/issue`

**权限**：`admin`

请求体：
```json
{
  "collectorId": "collector-uuid"
}
```

#### 6.6 恢复供电

**POST** `/api/billing/limit-orders/:id/restore`

**权限**：`admin`, `collector`

#### 6.7 获取账单列表

**GET** `/api/billing?page=1&pageSize=20&status=unpaid`

**权限**：`admin`, `collector`

#### 6.8 获取我的账单

**GET** `/api/billing/my`

#### 6.9 获取限电指令列表

**GET** `/api/billing/limit-orders`

**权限**：`admin`, `collector`

---

### 7. 碳排放核算模块

#### 7.1 计算每日碳排放

**POST** `/api/carbon/calculate`

**权限**：所有已认证用户

请求体：
```json
{
  "date": "2024-01-15"
}
```

#### 7.2 获取碳排放数据

**GET** `/api/carbon?startDate=2024-01-01&endDate=2024-01-15`

返回：按日汇总、按能源来源分类的排放数据

#### 7.3 获取碳积分

**GET** `/api/carbon/credits?page=1&pageSize=20`

#### 7.4 生成碳报告

**POST** `/api/carbon/report`

请求体：
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "format": "excel"
}
```

返回：Excel文件下载或报告数据

#### 7.5 转让碳积分

**POST** `/api/carbon/transfer`

请求体：
```json
{
  "toUserId": "user-uuid",
  "amount": 0.5
}
```

#### 7.6 获取月度汇总

**GET** `/api/carbon/summary?year=2024&month=1`

---

### 8. 能源运营日报模块

#### 8.1 生成日报

**POST** `/api/daily-reports/generate`

**权限**：`operator`, `admin`

请求体：
```json
{
  "reportDate": "2024-01-15",
  "region": "朝阳区"
}
```

#### 8.2 获取日报列表

**GET** `/api/daily-reports?startDate=2024-01-01&endDate=2024-01-15&page=1&pageSize=20`

**权限**：`operator`, `admin`

#### 8.3 获取日报详情

**GET** `/api/daily-reports/:id`

**权限**：`operator`, `admin`

返回包含30+项指标的完整日报数据

#### 8.4 导出日报

**POST** `/api/daily-reports/:id/export`

**权限**：`operator`, `admin`

请求体：
```json
{
  "format": "excel"
}
```

返回：包含3个工作表的Excel文件（运营总览、24小时数据、摘要与建议）

---

## 实时消息推送

系统使用Socket.io实现实时消息推送，支持以下事件：

### 连接方式

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### 消息类型

| 类型 | 说明 | 接收角色 |
|------|------|----------|
| `alert` | 设备告警 | operator, admin |
| `dispatch` | 调度指令 | operator, maintenance |
| `trade` | 交易结果 | trader, admin |
| `bill` | 账单通知 | 对应用户, collector |
| `work_order` | 工单通知 | maintenance, operator, admin |
| `demand_response` | 需求响应 | 对应用户 |
| `carbon` | 碳积分到账 | 对应用户 |
| `report` | 日报通知 | operator, admin |

### 订阅消息

```javascript
socket.on('alert', (data) => {
  console.log('收到告警:', data);
});

socket.on('dispatch', (data) => {
  console.log('收到调度指令:', data);
});
```

---

## 定时任务

系统使用node-cron实现自动定时任务：

| 任务 | 执行时间 | 说明 |
|------|----------|------|
| 月度账单生成 | 每月1日 00:00 | 自动生成上月所有用户账单 |
| 逾期账单检查 | 每日 00:00 | 检查逾期账单，逾期>30天生成限电指令 |
| 能源运营日报 | 每日 00:00 | 生成昨日各区域及全市运营日报 |
| 碳排放计算 | 每日 01:00 | 计算所有用户昨日碳排放，发放碳积分 |

### Cron表达式说明

```
* * * * * *
| | | | | |
| | | | | +--- 星期 (0-7)
| | | | +----- 月份 (1-12)
| | | +------- 日期 (1-31)
| | +--------- 小时 (0-23)
| +----------- 分钟 (0-59)
+------------- 秒 (0-59)
```

---

## 错误码说明

| HTTP状态码 | 说明 | 常见场景 |
|-----------|------|----------|
| 200 | 成功 | 请求成功 |
| 201 | 创建成功 | 资源创建成功 |
| 400 | 请求参数错误 | 参数验证失败 |
| 401 | 未认证 | Token无效或过期 |
| 403 | 无权限 | 角色权限不足 |
| 404 | 资源不存在 | 访问的ID不存在 |
| 409 | 冲突 | 状态冲突，如重复操作 |
| 500 | 服务器错误 | 系统内部错误 |

---

## 分时电价体系

系统采用三时段电价体系：

| 时段 | 时间 | 电价系数 |
|------|------|----------|
| 峰时 | 10:00-14:00, 18:00-22:00 | 1.5x |
| 平时 | 06:00-10:00, 14:00-18:00 | 1.0x |
| 谷时 | 00:00-06:00, 22:00-24:00 | 0.5x |

---

## 智能算法说明

### 用电计划推荐算法

三种策略的权重分配：

| 策略 | 电价权重 | 负荷预测权重 | 可再生能源占比权重 |
|------|----------|--------------|--------------------|
| 成本最优 | 100% | 0% | 0% |
| 综合平衡 | 50% | 30% | 20% |
| 环保优先 | 20% | 0% | 80% |

### 工单智能分配算法

综合评分 = 距离 × 0.5 + 工作负载 × 0.3 + 技能匹配 × 0.2

- 距离：Haversine公式计算抢修队与故障点距离
- 工作负载：抢修队当前处理工单数量
- 技能匹配：抢修队技能与工单要求的匹配度

### 碳排放核算模型

基于中国能源结构矩阵（煤炭55%、天然气15%、石油5%、核电5%、水电10%、风电5%、光伏3%、生物质1%、地热1%）和IPCC排放因子计算。

---

## 注意事项

1. 所有日期时间均使用ISO 8601格式（UTC时间）
2. 数值计算统一保留4位小数，金额保留2位小数
3. 分页查询默认page=1, pageSize=20，最大pageSize=100
4. WebSocket连接需要在握手时携带JWT Token
5. 定时任务在系统启动时自动初始化，无需手动触发
6. 导出的Excel文件存储在`exports/`目录下
