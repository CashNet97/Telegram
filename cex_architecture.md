# Centralized Exchange (CEX) Blueprint

Comprehensive architecture and implementation guide for a BloFin-like CEX with manual deposit address management via a dedicated admin panel.

## Архитектура проекта
- **Frontend (User)**: Next.js (App Router), React, Tailwind/Ant Design, WebSocket for order book and trades.
- **Frontend (Admin)**: Separate Next.js app under `/admin`, protected routes with RBAC (admin/operator), audit overlays.
- **Backend**: NestJS (Express adapter), REST + WebSocket gateways, JWT + refresh tokens, 2FA (TOTP), rate limiting, CSRF protection for cookies, RBAC guards.
- **Workers**: Background processors (BullMQ + Redis) for:
  - Blockchain listeners (BTC RPC, Ethereum via Infura/Alchemy, Solana RPC, TRON API).
  - Deposit confirmation jobs and balance crediting.
  - Withdrawal review/approval and broadcast.
  - Order matching engine (spot) and settlement.
- **Databases**: PostgreSQL (core data), Redis (sessions, cache, pub/sub for order book, rate limits).
- **Networking**: Reverse proxy (Nginx) terminating TLS, WAF rules, separated admin domain (e.g., `admin.cex.local`).
- **Keys & custody**: Logical hot/cold segregation, signed withdrawals routed through secure signer service (HSM-compatible API).
- **Observability**: Prometheus + Grafana dashboards, structured logs, alerting on balances, failed jobs, and auth anomalies.

## Структура базы данных (PostgreSQL)
- `users(id, email, password_hash, twofa_secret, role, status, created_at, updated_at, last_login_ip)`
- `user_sessions(id, user_id, refresh_token_hash, ip, ua, expires_at, created_at)`
- `assets(id, symbol, name, decimals, is_enabled)`
- `networks(id, code, name, is_enabled)`
- `asset_networks(id, asset_id, network_id, deposit_enabled, withdraw_enabled, min_deposit, min_withdraw, withdraw_fee, confirmations_required)`
- `deposit_addresses(id, user_id, asset_network_id, address, memo, comment, is_active, created_by_admin_id, created_at)`
- `deposits(id, user_id, asset_network_id, txid, address, amount, status, detected_at, confirmed_at, credited_at, confirmations, detected_by)`
- `withdrawals(id, user_id, asset_network_id, address, amount, fee, status, txid, requested_at, approved_at, rejected_at, processed_by, comment)`
- `balances(id, user_id, asset_id, available, locked, updated_at)`
- `orders(id, user_id, pair, side, price, amount, filled, status, created_at)`
- `trades(id, buy_order_id, sell_order_id, price, amount, fee_asset_id, fee_amount, created_at)`
- `admin_actions(id, admin_id, action, target_type, target_id, payload, created_at, ip)`

### ER-диаграмма (текстовая)
Users 1—N Balances, Deposits, Withdrawals, Orders; Assets 1—N AssetNetworks; AssetNetworks 1—N Deposits/Withdrawals/DepositAddresses; Orders 1—N Trades (buy/sell refs); Admins 1—N AdminActions.

## Backend API (ключевые эндпоинты)
### Auth & User
- `POST /api/auth/register { email, password, twofa_code? }`
- `POST /api/auth/login { email, password, twofa_code }`
- `POST /api/auth/refresh`
- `POST /api/auth/enable-2fa`, `POST /api/auth/verify-2fa`
- `GET /api/user/profile`, `GET /api/user/balances`

### Deposits
- `GET /api/deposits/options` → assets/networks + statuses
- `GET /api/deposits/address?asset=BTC&network=BTC` → fixed admin-set address/memo
- `GET /api/deposits/history`
- `POST /api/deposits/confirm-manual` (admin-triggered credit after review)

### Withdrawals
- `POST /api/withdrawals/request { asset, network, address, amount, twofa_code }`
- `GET /api/withdrawals/history`
- Admin: `POST /api/admin/withdrawals/:id/approve` | `/reject` | `/broadcast`

### Trading (Spot)
- `GET /api/markets`
- `GET /api/orderbook?pair=BTC-USDT` (WebSocket stream for depth + trades)
- `POST /api/orders` (limit/market), `DELETE /api/orders/:id`, `GET /api/orders/open`, `GET /api/trades`

### Admin Panel
- Auth: `POST /api/admin/login`
- Deposit addresses: `GET/POST/PATCH /api/admin/deposit-addresses`
- Networks/assets toggle: `PATCH /api/admin/networks/:id`, `PATCH /api/admin/assets/:id`
- Users: `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/users/:id/activity`
- Finance: `GET /api/admin/treasury`, `GET /api/admin/balances`
- Audit: `GET /api/admin/actions`

## Frontend страницы (User)
- `/register`, `/login`, 2FA setup/verify modal
- `/dashboard` — сводка балансов, уведомления, открытые ордера
- `/trade/[pair]` — ордербук, сделки, лимит/маркет-ордера, WebSocket depth
- `/deposit` — выбор валюты/сети, показ статического адреса, статус ожидания
- `/withdraw` — форма вывода с 2FA, проверка лимитов, статусы заявок
- `/history` — депозиты/выводы/трейды
- `/settings` — пароль, 2FA, API-keys (опционально)

## Админ-панель
- `/admin/login`
- `/admin/dashboard` — метрики, балансы по валютам
- `/admin/deposit-addresses` — CRUD адресов, включение/выключение сетей, комментарии
- `/admin/deposits` — входящие tx, статусы, ручное подтверждение и зачисление
- `/admin/withdrawals` — pending/approved/rejected, ручная обработка и отправка
- `/admin/users` — поиск, блокировка, просмотр балансов и действий
- `/admin/audit` — журнал действий админов

## Безопасность
- Bcrypt пароли, TOTP 2FA, JWT + refresh, short-lived access tokens
- RBAC guard (admin/operator/user) на маршрутах и WebSocket
- Rate limiting (per IP/user), reCAPTCHA при аномалиях
- CSRF (для cookie-based), HTTP-only/secure cookies, SameSite
- IP-логирование и алерты по смене устройства
- Принудительное KYC флаги (опционально), заморозка аккаунтов
- Логи админ-действий, неподписанные транзакции недоступны операторам

## Логика пополнения
1. Админ в панели создаёт адрес для комбинации Asset/Network (BTC, ETH, SOL, USDT-ERC20/BEP20/TRC20) и назначает пользователю или пулу.
2. Пользователь выбирает валюту и сеть → получает фиксированный адрес/мемо.
3. Listener воркеры мониторят блокчейн по списку адресов; при обнаружении tx создают запись `deposits` со статусом `pending`.
4. После нужных подтверждений воркер меняет статус на `detected` → `confirmed`; при ручном режиме админ жмёт "credit".
5. Баланс зачисляется транзакцией в БД (atomic update `balances.available += amount`).

## Логика вывода
1. Пользователь создаёт заявку с 2FA, лимитами и проверкой баланса → статус `pending` и `locked` средства.
2. Админ/оператор проверяет AML/фрод, подтверждает → статус `approved` и воркер отправляет транзакцию (hot wallet) или готовит файл для оффлайн-подписи.
3. После txid — статус `broadcast`; при неудаче → `rejected` и средства возвращаются из `locked`.

## Пример кода — Backend (NestJS)
```ts
// src/modules/deposit-addresses/deposit-addresses.controller.ts
@Post()
@Roles('admin', 'operator')
create(@Body() dto: CreateDepositAddressDto, @Req() req) {
  return this.service.create({ ...dto, createdBy: req.user.id });
}

@Get('user/:userId')
@Roles('admin', 'operator')
findByUser(@Param('userId') userId: string) {
  return this.service.findActiveByUser(userId);
}
```

```ts
// src/modules/deposits/deposits.listener.ts
@Injectable()
export class EthereumDepositListener {
  constructor(private readonly svc: DepositsService) {}
  @Interval(10_000)
  async poll() {
    const addresses = await this.svc.getActiveAddresses('USDT', 'ERC20');
    const txs = await this.scan(addresses); // вызов web3/ethers
    for (const tx of txs) {
      await this.svc.recordPending(tx);
    }
  }
}
```

```ts
// src/modules/balances/balances.service.ts
async creditDeposit(depositId: string) {
  return this.prisma.$transaction(async (tx) => {
    const deposit = await tx.deposits.update({
      where: { id: depositId, status: 'pending' },
      data: { status: 'confirmed', confirmed_at: new Date() },
    });
    await tx.balances.upsert({
      where: { user_id_asset_id: { user_id: deposit.user_id, asset_id: deposit.asset_id } },
      update: { available: { increment: deposit.amount } },
      create: { user_id: deposit.user_id, asset_id: deposit.asset_id, available: deposit.amount, locked: 0 },
    });
    return deposit;
  });
}
```

## Пример кода — Frontend (Next.js, React)
```tsx
// app/deposit/page.tsx
const DepositPage = () => {
  const [asset, setAsset] = useState('USDT');
  const [network, setNetwork] = useState('ERC20');
  const { data, isLoading } = useQuery(['depositAddress', asset, network], () =>
    api.get(`/deposits/address`, { params: { asset, network } })
  );
  return (
    <Card>
      <CardHeader title="Deposit" />
      <Select value={asset} onValueChange={setAsset} options={['BTC','ETH','SOL','USDT']} />
      <Select value={network} onValueChange={setNetwork} options={['ERC20','BEP20','TRC20']} />
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Send only {asset} via {network}</p>
          <CodeBlock>{data?.address}</CodeBlock>
          {data?.memo && <CodeBlock>Memo: {data.memo}</CodeBlock>}
        </div>
      )}
    </Card>
  );
};
```

```tsx
// app/admin/deposit-addresses/page.tsx
const AdminDepositAddresses = () => {
  const { data } = useQuery(['adminAddresses'], () => api.get('/admin/deposit-addresses'));
  const mutation = useMutation((payload) => api.post('/admin/deposit-addresses', payload));
  return (
    <div className="space-y-4">
      <Button onClick={() => openModal()}>Add Address</Button>
      <Table data={data} columns={[ 'asset', 'network', 'address', 'comment', 'is_active' ]} />
      <Modal>{/* form with asset/network/address/memo/comment */}</Modal>
    </div>
  );
};
```

## Документация и деплой
- **API**: OpenAPI/Swagger auto-generated by NestJS; versioned `/v1`.
- **Docker-compose**: services for api, admin-frontend, user-frontend, postgres, redis, worker, nginx.
- **.env.example**: JWT secrets, DB/Redis URLs, RPC endpoints, rate-limit configs, mail/SMS providers.
- **Архитектурная схема**: API ↔ Worker ↔ DB/Redis; WebSockets for trading; Admin panel separate origin/domain.

## Минимальные шаги запуска (dev)
1. `docker-compose up -d postgres redis`
2. `pnpm install` (root); `pnpm --filter api dev`, `pnpm --filter web dev`, `pnpm --filter admin dev`
3. Set RPC endpoints for BTC/EVM/Solana/TRON in `.env`; start workers `pnpm --filter worker dev`
4. Expose Swagger at `/api/docs` and protect admin routes via RBAC.

