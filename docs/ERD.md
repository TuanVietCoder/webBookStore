# Sơ đồ quan hệ thực thể (ERD) — Nhà sách PDF

Sinh tự động từ Data Dictionary đặc tả v2.0.3 (khớp với `schema.sql`). GitHub tự hiển thị các khối Mermaid bên dưới.

**Chú thích:** `||--o{` một-nhiều bắt buộc; `|o--o{` một-nhiều tùy chọn (FK cho phép NULL); `||--o|` một-một. Mỗi sơ đồ chỉ hiện khóa chính (PK), khóa ngoại (FK), cột unique (UK) và các cột trạng thái/loại/mã.
Các FK ghi nhận người thao tác lên `Users` (CreatedBy, UpdatedBy, DeletedBy, ApprovedBy, HandledBy...) không vẽ để sơ đồ dễ đọc; chúng vẫn có trong `schema.sql`.

Xem trực tiếp trong SSMS: chạy `schema.sql`, rồi Database Diagrams > New Database Diagram và chọn các bảng của nhóm cần xem.

## 0. Tổng quan toàn hệ thống (53 bảng, chỉ quan hệ)

```mermaid
erDiagram
    Roles ||--o{ RolePermissions : "RoleRowId"
    Permissions ||--o{ RolePermissions : "PermissionRowId"
    Roles ||--o{ Users : "RoleRowId"
    Users ||--o{ UserSessions : "UserRowId"
    Users ||--o{ PasswordResetRequests : "UserRowId"
    Users ||--o{ Notifications : "RecipientUserRowId"
    Publishers |o--o{ Books : "PublisherRowId"
    Books ||--o{ BookFiles : "BookRowId"
    Categories |o--o{ Categories : "ParentCategoryRowId"
    Books ||--o{ BookAuthors : "BookRowId"
    Authors ||--o{ BookAuthors : "AuthorRowId"
    Books ||--o{ BookCategories : "BookRowId"
    Categories ||--o{ BookCategories : "CategoryRowId"
    Books ||--o{ BookImages : "BookRowId"
    Users ||--o{ WishlistItems : "BuyerRowId"
    Books ||--o{ WishlistItems : "BookRowId"
    Users ||--o{ BrowsingHistory : "BuyerRowId"
    Books ||--o{ BrowsingHistory : "BookRowId"
    Users ||--o{ Carts : "BuyerRowId"
    Carts ||--o{ CartItems : "CartRowId"
    Books |o--o{ CartItems : "BookRowId"
    Bundles |o--o{ CartItems : "BundleRowId"
    Users ||--o{ CartItems : "RecipientUserRowId"
    BundleRevisions |o--o{ CartItems : "BundleRevisionRowId"
    CartItems ||--o{ CartItemBooks : "CartItemRowId"
    Books ||--o{ CartItemBooks : "BookRowId"
    Users ||--o{ Orders : "BuyerRowId"
    Coupons |o--o{ Orders : "CouponRowId"
    Events |o--o{ Orders : "EventRowId"
    Carts ||--o| Orders : "CartRowId"
    CouponRevisions |o--o{ Orders : "CouponRevisionRowId"
    EventRevisions |o--o{ Orders : "EventRevisionRowId"
    Orders ||--o{ OrderItems : "OrderRowId"
    Books |o--o{ OrderItems : "BookRowId"
    Bundles |o--o{ OrderItems : "BundleRowId"
    Users ||--o{ OrderItems : "RecipientUserRowId"
    BundleRevisions |o--o{ OrderItems : "BundleRevisionRowId"
    OrderItems ||--o{ OrderItemBooks : "OrderItemRowId"
    Books ||--o{ OrderItemBooks : "BookRowId"
    Orders ||--o{ PaymentAttempts : "OrderRowId"
    PaymentAttempts ||--o{ PaymentGatewayEvents : "PaymentAttemptRowId"
    Orders ||--o{ OrderStatusHistory : "OrderRowId"
    Users ||--o{ DigitalEntitlements : "UserRowId"
    Books ||--o{ DigitalEntitlements : "BookRowId"
    DigitalEntitlements ||--o{ EntitlementSources : "EntitlementRowId"
    OrderItemBooks ||--o| EntitlementSources : "OrderItemBookRowId"
    Users ||--o{ BookAccessLogs : "UserRowId"
    Books ||--o{ BookAccessLogs : "BookRowId"
    BundleRevisions ||--o{ BundleBooks : "BundleRevisionRowId"
    Books ||--o{ BundleBooks : "BookRowId"
    EventRevisions ||--o{ EventBooks : "EventRevisionRowId"
    Books ||--o{ EventBooks : "BookRowId"
    EventRevisions ||--o{ EventBundles : "EventRevisionRowId"
    Bundles ||--o{ EventBundles : "BundleRowId"
    Coupons ||--o{ CouponUsages : "CouponRowId"
    Orders ||--o| CouponUsages : "OrderRowId"
    Users ||--o{ CouponUsages : "BuyerRowId"
    CouponRevisions ||--o{ CouponUsages : "CouponRevisionRowId"
    Users ||--o{ Reviews : "BuyerRowId"
    Books ||--o{ Reviews : "BookRowId"
    OrderItemBooks ||--o{ Reviews : "VerifiedOrderItemBookRowId"
    Users ||--o{ ContentReports : "ReporterUserRowId"
    Users ||--o{ Complaints : "BuyerRowId"
    Orders |o--o{ Complaints : "OrderRowId"
    EntitlementSources |o--o{ Complaints : "EntitlementSourceRowId"
    Complaints ||--o{ ComplaintMessages : "ComplaintRowId"
    Users ||--o{ ComplaintMessages : "SenderUserRowId"
    Users |o--o{ AIConversations : "OwnerUserRowId"
    AIConversations ||--o{ AIMessages : "ConversationRowId"
    AIConversations ||--o{ AIActionLogs : "ConversationRowId"
    Users |o--o{ AIActionLogs : "InitiatorUserRowId"
    AIActionRequests |o--o{ AIActionLogs : "ActionRequestRowId"
    Users |o--o{ AuditLogs : "ActorUserRowId"
    Bundles ||--o{ BundleRevisions : "BundleRowId"
    Events ||--o{ EventRevisions : "EventRowId"
    Coupons ||--o{ CouponRevisions : "CouponRowId"
    Users ||--o{ AIActionRequests : "InitiatorUserRowId"
    AIConversations ||--o{ AIActionRequests : "ConversationRowId"
    PaymentGatewayEvents |o--o{ PaymentCallbackReceipts : "GatewayEventRowId"
```

## 1. Tài khoản, phân quyền và thông báo

Bảng: `Roles`, `Permissions`, `RolePermissions`, `Users`, `UserSessions`, `PasswordResetRequests`, `Notifications`. Bảng liên quan nhóm khác: `AIActionLogs`, `AIActionRequests`, `AIConversations`, `AuditLogs`, `BookAccessLogs`, `BrowsingHistory`, `CartItems`, `Carts`, `ComplaintMessages`, `Complaints`, `ContentReports`, `CouponUsages`, `DigitalEntitlements`, `OrderItems`, `Orders`, `Reviews`, `WishlistItems`

```mermaid
erDiagram
    Roles ||--o{ RolePermissions : "RoleRowId"
    Permissions ||--o{ RolePermissions : "PermissionRowId"
    Roles ||--o{ Users : "RoleRowId"
    Users ||--o{ UserSessions : "UserRowId"
    Users ||--o{ PasswordResetRequests : "UserRowId"
    Users ||--o{ Notifications : "RecipientUserRowId"
    Users ||--o{ WishlistItems : "BuyerRowId"
    Users ||--o{ BrowsingHistory : "BuyerRowId"
    Users ||--o{ Carts : "BuyerRowId"
    Users ||--o{ CartItems : "RecipientUserRowId"
    Users ||--o{ Orders : "BuyerRowId"
    Users ||--o{ OrderItems : "RecipientUserRowId"
    Users ||--o{ DigitalEntitlements : "UserRowId"
    Users ||--o{ BookAccessLogs : "UserRowId"
    Users ||--o{ CouponUsages : "BuyerRowId"
    Users ||--o{ Reviews : "BuyerRowId"
    Users ||--o{ ContentReports : "ReporterUserRowId"
    Users ||--o{ Complaints : "BuyerRowId"
    Users ||--o{ ComplaintMessages : "SenderUserRowId"
    Users |o--o{ AIConversations : "OwnerUserRowId"
    Users |o--o{ AIActionLogs : "InitiatorUserRowId"
    Users |o--o{ AuditLogs : "ActorUserRowId"
    Users ||--o{ AIActionRequests : "InitiatorUserRowId"
    Roles {
        BIGINT RowId PK
        VARCHAR RoleCode UK
    }
    Permissions {
        BIGINT RowId PK
        VARCHAR PermissionCode UK
        VARCHAR ModuleCode
    }
    RolePermissions {
        BIGINT RowId PK
        BIGINT RoleRowId FK
        BIGINT PermissionRowId FK
    }
    Users {
        BIGINT RowId PK
        VARCHAR UserId UK
        BIGINT RoleRowId FK
        VARCHAR AccountStatus
        NVARCHAR NormalizedEmail UK
    }
    UserSessions {
        BIGINT RowId PK
        BIGINT UserRowId FK
        CHAR RefreshTokenHash UK
    }
    PasswordResetRequests {
        BIGINT RowId PK
        BIGINT UserRowId FK
        CHAR TokenHash UK
    }
    Notifications {
        BIGINT RowId PK
        BIGINT RecipientUserRowId FK
        VARCHAR NotificationType
    }
    AIActionLogs {
        BIGINT RowId PK
    }
    AIActionRequests {
        BIGINT RowId PK
    }
    AIConversations {
        BIGINT RowId PK
    }
    AuditLogs {
        BIGINT RowId PK
    }
    BookAccessLogs {
        BIGINT RowId PK
    }
    BrowsingHistory {
        BIGINT RowId PK
    }
    CartItems {
        BIGINT RowId PK
    }
    Carts {
        BIGINT RowId PK
    }
    ComplaintMessages {
        BIGINT RowId PK
    }
    Complaints {
        BIGINT RowId PK
    }
    ContentReports {
        BIGINT RowId PK
    }
    CouponUsages {
        BIGINT RowId PK
    }
    DigitalEntitlements {
        BIGINT RowId PK
    }
    OrderItems {
        BIGINT RowId PK
    }
    Orders {
        BIGINT RowId PK
    }
    Reviews {
        BIGINT RowId PK
    }
    WishlistItems {
        BIGINT RowId PK
    }
```

## 2. Catalog sách PDF

Bảng: `Books`, `BookFiles`, `Authors`, `Publishers`, `Categories`, `BookAuthors`, `BookCategories`, `BookImages`, `WishlistItems`, `BrowsingHistory`. Bảng liên quan nhóm khác: `BookAccessLogs`, `BundleBooks`, `CartItemBooks`, `CartItems`, `DigitalEntitlements`, `EventBooks`, `OrderItemBooks`, `OrderItems`, `Reviews`, `Users`

```mermaid
erDiagram
    Publishers |o--o{ Books : "PublisherRowId"
    Books ||--o{ BookFiles : "BookRowId"
    Categories |o--o{ Categories : "ParentCategoryRowId"
    Books ||--o{ BookAuthors : "BookRowId"
    Authors ||--o{ BookAuthors : "AuthorRowId"
    Books ||--o{ BookCategories : "BookRowId"
    Categories ||--o{ BookCategories : "CategoryRowId"
    Books ||--o{ BookImages : "BookRowId"
    Users ||--o{ WishlistItems : "BuyerRowId"
    Books ||--o{ WishlistItems : "BookRowId"
    Users ||--o{ BrowsingHistory : "BuyerRowId"
    Books ||--o{ BrowsingHistory : "BookRowId"
    Books |o--o{ CartItems : "BookRowId"
    Books ||--o{ CartItemBooks : "BookRowId"
    Books |o--o{ OrderItems : "BookRowId"
    Books ||--o{ OrderItemBooks : "BookRowId"
    Books ||--o{ DigitalEntitlements : "BookRowId"
    Books ||--o{ BookAccessLogs : "BookRowId"
    Books ||--o{ BundleBooks : "BookRowId"
    Books ||--o{ EventBooks : "BookRowId"
    Books ||--o{ Reviews : "BookRowId"
    Books {
        BIGINT RowId PK
        VARCHAR BookId UK
        BIGINT PublisherRowId FK
        VARCHAR LanguageCode
        VARCHAR Status
    }
    BookFiles {
        BIGINT RowId PK
        BIGINT BookRowId FK
        NVARCHAR StorageKey UK
        VARCHAR MimeType
    }
    Authors {
        BIGINT RowId PK
        VARCHAR AuthorCode
    }
    Publishers {
        BIGINT RowId PK
        VARCHAR PublisherCode
    }
    Categories {
        BIGINT RowId PK
        VARCHAR CategoryCode UK
        BIGINT ParentCategoryRowId FK
    }
    BookAuthors {
        BIGINT RowId PK
        BIGINT BookRowId FK
        BIGINT AuthorRowId FK
    }
    BookCategories {
        BIGINT RowId PK
        BIGINT BookRowId FK
        BIGINT CategoryRowId FK
    }
    BookImages {
        BIGINT RowId PK
        BIGINT BookRowId FK
    }
    WishlistItems {
        BIGINT RowId PK
        BIGINT BuyerRowId FK
        BIGINT BookRowId FK
    }
    BrowsingHistory {
        BIGINT RowId PK
        BIGINT BuyerRowId FK
        BIGINT BookRowId FK
    }
    BookAccessLogs {
        BIGINT RowId PK
    }
    BundleBooks {
        BIGINT RowId PK
    }
    CartItemBooks {
        BIGINT RowId PK
    }
    CartItems {
        BIGINT RowId PK
    }
    DigitalEntitlements {
        BIGINT RowId PK
    }
    EventBooks {
        BIGINT RowId PK
    }
    OrderItemBooks {
        BIGINT RowId PK
    }
    OrderItems {
        BIGINT RowId PK
    }
    Reviews {
        BIGINT RowId PK
    }
    Users {
        BIGINT RowId PK
    }
```

## 3. Giỏ hàng, đơn hàng, thanh toán và thư viện

Bảng: `Carts`, `CartItems`, `CartItemBooks`, `Orders`, `OrderItems`, `OrderItemBooks`, `PaymentAttempts`, `PaymentGatewayEvents`, `OrderStatusHistory`, `DigitalEntitlements`, `EntitlementSources`, `BookAccessLogs`, `PaymentCallbackReceipts`. Bảng liên quan nhóm khác: `Books`, `BundleRevisions`, `Bundles`, `Complaints`, `CouponRevisions`, `CouponUsages`, `Coupons`, `EventRevisions`, `Events`, `Reviews`, `Users`

```mermaid
erDiagram
    Users ||--o{ Carts : "BuyerRowId"
    Carts ||--o{ CartItems : "CartRowId"
    Books |o--o{ CartItems : "BookRowId"
    Bundles |o--o{ CartItems : "BundleRowId"
    Users ||--o{ CartItems : "RecipientUserRowId"
    BundleRevisions |o--o{ CartItems : "BundleRevisionRowId"
    CartItems ||--o{ CartItemBooks : "CartItemRowId"
    Books ||--o{ CartItemBooks : "BookRowId"
    Users ||--o{ Orders : "BuyerRowId"
    Coupons |o--o{ Orders : "CouponRowId"
    Events |o--o{ Orders : "EventRowId"
    Carts ||--o| Orders : "CartRowId"
    CouponRevisions |o--o{ Orders : "CouponRevisionRowId"
    EventRevisions |o--o{ Orders : "EventRevisionRowId"
    Orders ||--o{ OrderItems : "OrderRowId"
    Books |o--o{ OrderItems : "BookRowId"
    Bundles |o--o{ OrderItems : "BundleRowId"
    Users ||--o{ OrderItems : "RecipientUserRowId"
    BundleRevisions |o--o{ OrderItems : "BundleRevisionRowId"
    OrderItems ||--o{ OrderItemBooks : "OrderItemRowId"
    Books ||--o{ OrderItemBooks : "BookRowId"
    Orders ||--o{ PaymentAttempts : "OrderRowId"
    PaymentAttempts ||--o{ PaymentGatewayEvents : "PaymentAttemptRowId"
    Orders ||--o{ OrderStatusHistory : "OrderRowId"
    Users ||--o{ DigitalEntitlements : "UserRowId"
    Books ||--o{ DigitalEntitlements : "BookRowId"
    DigitalEntitlements ||--o{ EntitlementSources : "EntitlementRowId"
    OrderItemBooks ||--o| EntitlementSources : "OrderItemBookRowId"
    Users ||--o{ BookAccessLogs : "UserRowId"
    Books ||--o{ BookAccessLogs : "BookRowId"
    Orders ||--o| CouponUsages : "OrderRowId"
    OrderItemBooks ||--o{ Reviews : "VerifiedOrderItemBookRowId"
    Orders |o--o{ Complaints : "OrderRowId"
    EntitlementSources |o--o{ Complaints : "EntitlementSourceRowId"
    PaymentGatewayEvents |o--o{ PaymentCallbackReceipts : "GatewayEventRowId"
    Carts {
        BIGINT RowId PK
        BIGINT BuyerRowId FK
        VARCHAR CartStatus
    }
    CartItems {
        BIGINT RowId PK
        BIGINT CartRowId FK
        VARCHAR ProductType
        BIGINT BookRowId FK
        BIGINT BundleRowId FK
        BIGINT RecipientUserRowId FK
        BIGINT BundleRevisionRowId FK
    }
    CartItemBooks {
        BIGINT RowId PK
        BIGINT CartItemRowId FK
        BIGINT BookRowId FK
    }
    Orders {
        BIGINT RowId PK
        VARCHAR OrderId UK
        BIGINT BuyerRowId FK
        VARCHAR OrderStatus
        BIGINT CouponRowId FK
        BIGINT EventRowId FK
        BIGINT CartRowId FK
        BIGINT CouponRevisionRowId FK
        BIGINT EventRevisionRowId FK
    }
    OrderItems {
        BIGINT RowId PK
        BIGINT OrderRowId FK
        VARCHAR ProductType
        BIGINT BookRowId FK
        BIGINT BundleRowId FK
        BIGINT RecipientUserRowId FK
        BIGINT BundleRevisionRowId FK
    }
    OrderItemBooks {
        BIGINT RowId PK
        BIGINT OrderItemRowId FK
        BIGINT BookRowId FK
    }
    PaymentAttempts {
        BIGINT RowId PK
        VARCHAR PaymentAttemptId UK
        BIGINT OrderRowId FK
        VARCHAR Status
        VARCHAR FailureCode
        VARCHAR PaymentType
    }
    PaymentGatewayEvents {
        BIGINT RowId PK
        VARCHAR GatewayEventId UK
        BIGINT PaymentAttemptRowId FK
        VARCHAR GatewayStatus
    }
    OrderStatusHistory {
        BIGINT RowId PK
        BIGINT OrderRowId FK
        VARCHAR OldStatus
        VARCHAR NewStatus
    }
    DigitalEntitlements {
        BIGINT RowId PK
        BIGINT UserRowId FK
        BIGINT BookRowId FK
        VARCHAR EntitlementStatus
    }
    EntitlementSources {
        BIGINT RowId PK
        BIGINT EntitlementRowId FK
        BIGINT OrderItemBookRowId FK
        VARCHAR SourceType
    }
    BookAccessLogs {
        BIGINT RowId PK
        BIGINT UserRowId FK
        BIGINT BookRowId FK
        VARCHAR AccessType
    }
    PaymentCallbackReceipts {
        BIGINT RowId PK
        BIGINT GatewayEventRowId FK
        VARCHAR ReasonCode
    }
    Books {
        BIGINT RowId PK
    }
    BundleRevisions {
        BIGINT RowId PK
    }
    Bundles {
        BIGINT RowId PK
    }
    Complaints {
        BIGINT RowId PK
    }
    CouponRevisions {
        BIGINT RowId PK
    }
    CouponUsages {
        BIGINT RowId PK
    }
    Coupons {
        BIGINT RowId PK
    }
    EventRevisions {
        BIGINT RowId PK
    }
    Events {
        BIGINT RowId PK
    }
    Reviews {
        BIGINT RowId PK
    }
    Users {
        BIGINT RowId PK
    }
```

## 4. Bundle, Event, Coupon (revision)

Bảng: `Bundles`, `BundleBooks`, `Events`, `EventBooks`, `EventBundles`, `Coupons`, `CouponUsages`, `BundleRevisions`, `EventRevisions`, `CouponRevisions`. Bảng liên quan nhóm khác: `Books`, `CartItems`, `OrderItems`, `Orders`, `Users`

```mermaid
erDiagram
    Bundles |o--o{ CartItems : "BundleRowId"
    BundleRevisions |o--o{ CartItems : "BundleRevisionRowId"
    Coupons |o--o{ Orders : "CouponRowId"
    Events |o--o{ Orders : "EventRowId"
    CouponRevisions |o--o{ Orders : "CouponRevisionRowId"
    EventRevisions |o--o{ Orders : "EventRevisionRowId"
    Bundles |o--o{ OrderItems : "BundleRowId"
    BundleRevisions |o--o{ OrderItems : "BundleRevisionRowId"
    BundleRevisions ||--o{ BundleBooks : "BundleRevisionRowId"
    Books ||--o{ BundleBooks : "BookRowId"
    EventRevisions ||--o{ EventBooks : "EventRevisionRowId"
    Books ||--o{ EventBooks : "BookRowId"
    EventRevisions ||--o{ EventBundles : "EventRevisionRowId"
    Bundles ||--o{ EventBundles : "BundleRowId"
    Coupons ||--o{ CouponUsages : "CouponRowId"
    Orders ||--o| CouponUsages : "OrderRowId"
    Users ||--o{ CouponUsages : "BuyerRowId"
    CouponRevisions ||--o{ CouponUsages : "CouponRevisionRowId"
    Bundles ||--o{ BundleRevisions : "BundleRowId"
    Events ||--o{ EventRevisions : "EventRowId"
    Coupons ||--o{ CouponRevisions : "CouponRowId"
    Bundles {
        BIGINT RowId PK
        VARCHAR BundleId UK
    }
    BundleBooks {
        BIGINT RowId PK
        BIGINT BundleRevisionRowId FK
        BIGINT BookRowId FK
    }
    Events {
        BIGINT RowId PK
        VARCHAR EventId UK
    }
    EventBooks {
        BIGINT RowId PK
        BIGINT EventRevisionRowId FK
        BIGINT BookRowId FK
    }
    EventBundles {
        BIGINT RowId PK
        BIGINT EventRevisionRowId FK
        BIGINT BundleRowId FK
    }
    Coupons {
        BIGINT RowId PK
        VARCHAR CouponId UK
        VARCHAR CouponCode UK
    }
    CouponUsages {
        BIGINT RowId PK
        BIGINT CouponRowId FK
        BIGINT OrderRowId FK
        BIGINT BuyerRowId FK
        VARCHAR UsageStatus
        BIGINT CouponRevisionRowId FK
    }
    BundleRevisions {
        BIGINT RowId PK
        BIGINT BundleRowId FK
        VARCHAR BundleType
        VARCHAR ApprovalStatus
    }
    EventRevisions {
        BIGINT RowId PK
        BIGINT EventRowId FK
        VARCHAR EventType
        VARCHAR ThemePresetCode
        VARCHAR ApprovalStatus
    }
    CouponRevisions {
        BIGINT RowId PK
        BIGINT CouponRowId FK
        VARCHAR DiscountType
        VARCHAR ApprovalStatus
    }
    Books {
        BIGINT RowId PK
    }
    CartItems {
        BIGINT RowId PK
    }
    OrderItems {
        BIGINT RowId PK
    }
    Orders {
        BIGINT RowId PK
    }
    Users {
        BIGINT RowId PK
    }
```

## 5. Đánh giá, báo cáo vi phạm, khiếu nại

Bảng: `Reviews`, `ContentReports`, `Complaints`, `ComplaintMessages`. Bảng liên quan nhóm khác: `Books`, `EntitlementSources`, `OrderItemBooks`, `Orders`, `Users`

```mermaid
erDiagram
    Users ||--o{ Reviews : "BuyerRowId"
    Books ||--o{ Reviews : "BookRowId"
    OrderItemBooks ||--o{ Reviews : "VerifiedOrderItemBookRowId"
    Users ||--o{ ContentReports : "ReporterUserRowId"
    Users ||--o{ Complaints : "BuyerRowId"
    Orders |o--o{ Complaints : "OrderRowId"
    EntitlementSources |o--o{ Complaints : "EntitlementSourceRowId"
    Complaints ||--o{ ComplaintMessages : "ComplaintRowId"
    Users ||--o{ ComplaintMessages : "SenderUserRowId"
    Reviews {
        BIGINT RowId PK
        BIGINT BuyerRowId FK
        BIGINT BookRowId FK
        BIGINT VerifiedOrderItemBookRowId FK
        VARCHAR ReviewStatus
    }
    ContentReports {
        BIGINT RowId PK
        VARCHAR ReportId UK
        BIGINT ReporterUserRowId FK
        VARCHAR TargetType
        VARCHAR ReasonCode
        VARCHAR ReportStatus
    }
    Complaints {
        BIGINT RowId PK
        VARCHAR ComplaintId UK
        BIGINT BuyerRowId FK
        BIGINT OrderRowId FK
        VARCHAR ComplaintStatus
        BIGINT EntitlementSourceRowId FK
    }
    ComplaintMessages {
        BIGINT RowId PK
        BIGINT ComplaintRowId FK
        BIGINT SenderUserRowId FK
    }
    Books {
        BIGINT RowId PK
    }
    EntitlementSources {
        BIGINT RowId PK
    }
    OrderItemBooks {
        BIGINT RowId PK
    }
    Orders {
        BIGINT RowId PK
    }
    Users {
        BIGINT RowId PK
    }
```

## 6. Trợ lý AI và tri thức

Bảng: `AIConversations`, `AIMessages`, `AIActionLogs`, `KnowledgeArticles`, `AIActionRequests`. Bảng liên quan nhóm khác: `Users`

```mermaid
erDiagram
    Users |o--o{ AIConversations : "OwnerUserRowId"
    AIConversations ||--o{ AIMessages : "ConversationRowId"
    AIConversations ||--o{ AIActionLogs : "ConversationRowId"
    Users |o--o{ AIActionLogs : "InitiatorUserRowId"
    AIActionRequests |o--o{ AIActionLogs : "ActionRequestRowId"
    Users ||--o{ AIActionRequests : "InitiatorUserRowId"
    AIConversations ||--o{ AIActionRequests : "ConversationRowId"
    AIConversations {
        BIGINT RowId PK
        BIGINT OwnerUserRowId FK
        VARCHAR AssistantType
        VARCHAR ConversationStatus
    }
    AIMessages {
        BIGINT RowId PK
        BIGINT ConversationRowId FK
    }
    AIActionLogs {
        BIGINT RowId PK
        BIGINT ConversationRowId FK
        BIGINT InitiatorUserRowId FK
        VARCHAR ActionType
        VARCHAR ConfirmationStatus
        VARCHAR ExecutionStatus
        BIGINT ActionRequestRowId FK
    }
    KnowledgeArticles {
        BIGINT RowId PK
        VARCHAR ArticleCode UK
        VARCHAR ArticleStatus
    }
    AIActionRequests {
        BIGINT RowId PK
        BIGINT InitiatorUserRowId FK
        BIGINT ConversationRowId FK
        BINARY TokenHash UK
        VARCHAR RequestStatus
    }
    Users {
        BIGINT RowId PK
    }
```

## 7. Nhật ký và vận hành

Bảng: `AuditLogs`, `SystemLogs`, `SystemSettings`, `OutboxMessages`. Bảng liên quan nhóm khác: `Users`

```mermaid
erDiagram
    Users |o--o{ AuditLogs : "ActorUserRowId"
    AuditLogs {
        BIGINT RowId PK
        BIGINT ActorUserRowId FK
        VARCHAR ActorType
        VARCHAR ActionCode
    }
    SystemLogs {
        BIGINT RowId PK
        VARCHAR ExceptionCode
    }
    SystemSettings {
        BIGINT RowId PK
        VARCHAR SettingKey UK
    }
    OutboxMessages {
        BIGINT RowId PK
        VARCHAR MessageKey UK
        VARCHAR EventType
        VARCHAR DeliveryStatus
    }
    Users {
        BIGINT RowId PK
    }
```
