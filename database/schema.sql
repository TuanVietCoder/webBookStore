/* =====================================================================
   Nhà sách PDF - Schema SQL Server (sinh từ Data Dictionary, đặc tả v2.0.3)
   Cách chạy:
     1) Tạo database trống (ví dụ NhaSachPDF), chọn đúng database đó.
     2) Chạy toàn bộ file này trong SSMS (mỗi khối GO chạy độc lập).
     3) Xem diagram: SSMS > Databases > NhaSachPDF > Database Diagrams > New Database Diagram,
        chọn tất cả bảng. Có thể chia sơ đồ theo nhóm bảng ở docs/ERD.md.
   Quy ước: khóa chính RowId BIGINT IDENTITY; FK đặt tên <Thực thể>RowId;
            FK mặc định ON DELETE NO ACTION; tiền DECIMAL(18,2); thời gian DATETIME2(3) UTC.
   Thứ tự: (A) tạo bảng, (B) khóa ngoại, (C) unique/index, (D) ràng buộc CHECK.
   ===================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- ====================== (A) TẠO BẢNG ======================

-- 7.01 Roles — Danh mục đúng ba vai trò hệ thống; Manager kế thừa permission Employee qua cấu hình RolePermissions.
CREATE TABLE dbo.[Roles] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    [RoleCode] VARCHAR(20) NOT NULL,
    [RoleName] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [IsSystem] BIT NOT NULL CONSTRAINT DF_Roles_IsSystem DEFAULT 1,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Roles_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Roles_Version DEFAULT 1
);
GO

-- 7.02 Permissions — Từ điển mã quyền dùng ở backend và AI tool guard.
CREATE TABLE dbo.[Permissions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
    [PermissionCode] VARCHAR(80) NOT NULL,
    [ModuleCode] VARCHAR(30) NOT NULL,
    [PermissionName] NVARCHAR(150) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Permissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Permissions_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Permissions_Version DEFAULT 1
);
GO

-- 7.03 RolePermissions — Gán permission cho role; Manager chứa toàn bộ permission của Employee.
CREATE TABLE dbo.[RolePermissions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RolePermissions PRIMARY KEY,
    [RoleRowId] BIGINT NOT NULL,
    [PermissionRowId] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_RolePermissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL
);
GO

-- 7.04 Users — Tài khoản đăng nhập dùng chung Buyer/Admin. Employee không truy cập hồ sơ bảo mật của Buyer khác nếu không có permission.
CREATE TABLE dbo.[Users] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    [UserId] VARCHAR(30) NOT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [PasswordHash] NVARCHAR(500) NOT NULL,
    [DisplayName] NVARCHAR(150) NOT NULL,
    [Phone] VARCHAR(20) NULL,
    [AvatarUrl] NVARCHAR(1000) NULL,
    [RoleRowId] BIGINT NOT NULL,
    [AccountStatus] VARCHAR(20) NOT NULL,
    [DisabledAt] DATETIME2(3) NULL,
    [DisabledBy] BIGINT NULL,
    [DisableReason] NVARCHAR(500) NULL,
    [EmailVerifiedAt] DATETIME2(3) NULL,
    [LastLoginAt] DATETIME2(3) NULL,
    [NormalizedEmail] NVARCHAR(254) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Users_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Users_Version DEFAULT 1
);
GO

-- 7.05 UserSessions — Lưu phiên đăng nhập và trạng thái token, cho phép thu hồi khi tài khoản bị khóa.
CREATE TABLE dbo.[UserSessions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY,
    [UserRowId] BIGINT NOT NULL,
    [RefreshTokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2(3) NOT NULL,
    [RevokedAt] DATETIME2(3) NULL,
    [IpAddress] VARCHAR(45) NULL,
    [UserAgent] NVARCHAR(512) NULL,
    [DeviceName] NVARCHAR(120) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NULL
);
GO

-- 7.06 PasswordResetRequests — Luồng đặt lại mật khẩu bằng mã một lần có hạn.
CREATE TABLE dbo.[PasswordResetRequests] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PasswordResetRequests PRIMARY KEY,
    [UserRowId] BIGINT NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2(3) NOT NULL,
    [UsedAt] DATETIME2(3) NULL,
    [RequestedIp] VARCHAR(45) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_PasswordResetRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NULL
);
GO

-- 7.07 Notifications — Thông báo tới Buyer/Employee/Manager (đã mua, nhận quà, event duyệt, complaint xử lý).
CREATE TABLE dbo.[Notifications] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    [RecipientUserRowId] BIGINT NOT NULL,
    [NotificationType] VARCHAR(40) NOT NULL,
    [Title] NVARCHAR(200) NOT NULL,
    [Body] NVARCHAR(1000) NOT NULL,
    [RelatedTable] VARCHAR(80) NULL,
    [RelatedRowId] BIGINT NULL,
    [ReadAt] DATETIME2(3) NULL,
    [MessageKey] VARCHAR(120) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NULL
);
GO

-- 7.08 Books — Thực thể đầu sách số; không còn BookVariants/Inventory.
CREATE TABLE dbo.[Books] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Books PRIMARY KEY,
    [BookId] VARCHAR(30) NOT NULL,
    [Title] NVARCHAR(300) NOT NULL,
    [Subtitle] NVARCHAR(300) NULL,
    [Description] NVARCHAR(MAX) NULL,
    [PublisherRowId] BIGINT NULL,
    [LanguageCode] VARCHAR(10) NOT NULL,
    [PublicationDate] DATE NULL,
    [PageCount] INT NULL,
    [OriginalPrice] DECIMAL(18,2) NOT NULL,
    [CoverImageUrl] NVARCHAR(1000) NULL,
    [Status] VARCHAR(20) NOT NULL,
    [PublishedAt] DATETIME2(3) NULL,
    [ServingSuspendedAt] DATETIME2(3) NULL,
    [SuspensionReason] NVARCHAR(500) NULL,
    [SuspendedBy] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Books_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Books_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Books_Version DEFAULT 1
);
GO

-- 7.09 BookFiles — Metadata PDF trong kho private; không lưu bytes trực tiếp.
CREATE TABLE dbo.[BookFiles] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BookFiles PRIMARY KEY,
    [BookRowId] BIGINT NOT NULL,
    [StorageKey] NVARCHAR(450) NOT NULL,
    [OriginalFileName] NVARCHAR(260) NOT NULL,
    [MimeType] VARCHAR(80) NOT NULL,
    [FileSizeBytes] BIGINT NOT NULL,
    [Sha256Hash] CHAR(64) NOT NULL,
    [FileVersion] INT NOT NULL,
    [IsCurrent] BIT NOT NULL,
    [UploadedBy] BIGINT NOT NULL,
    [UploadedAt] DATETIME2(3) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BookFiles_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_BookFiles_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BookFiles_Version DEFAULT 1
);
GO

-- 7.10 Authors — Thông tin tác giả.
CREATE TABLE dbo.[Authors] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Authors PRIMARY KEY,
    [AuthorCode] VARCHAR(30) NULL,
    [FullName] NVARCHAR(200) NOT NULL,
    [Biography] NVARCHAR(MAX) NULL,
    [PortraitUrl] NVARCHAR(1000) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Authors_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Authors_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Authors_Version DEFAULT 1
);
GO

-- 7.11 Publishers — Nhà xuất bản sách.
CREATE TABLE dbo.[Publishers] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Publishers PRIMARY KEY,
    [PublisherCode] VARCHAR(30) NULL,
    [PublisherName] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(MAX) NULL,
    [WebsiteUrl] NVARCHAR(1000) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Publishers_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Publishers_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Publishers_Version DEFAULT 1
);
GO

-- 7.12 Categories — Danh mục chủ đề sách (có thể phân cấp).
CREATE TABLE dbo.[Categories] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
    [CategoryCode] VARCHAR(40) NOT NULL,
    [CategoryName] NVARCHAR(150) NOT NULL,
    [ParentCategoryRowId] BIGINT NULL,
    [Description] NVARCHAR(500) NULL,
    [SortOrder] INT NOT NULL CONSTRAINT DF_Categories_SortOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Categories_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Categories_Version DEFAULT 1
);
GO

-- 7.13 BookAuthors — Liên kết nhiều-nhiều Books và Authors.
CREATE TABLE dbo.[BookAuthors] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BookAuthors PRIMARY KEY,
    [BookRowId] BIGINT NOT NULL,
    [AuthorRowId] BIGINT NOT NULL,
    [AuthorOrder] INT NOT NULL CONSTRAINT DF_BookAuthors_AuthorOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BookAuthors_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_BookAuthors_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BookAuthors_Version DEFAULT 1
);
GO

-- 7.14 BookCategories — Liên kết nhiều-nhiều Books và Categories.
CREATE TABLE dbo.[BookCategories] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BookCategories PRIMARY KEY,
    [BookRowId] BIGINT NOT NULL,
    [CategoryRowId] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BookCategories_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_BookCategories_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BookCategories_Version DEFAULT 1
);
GO

-- 7.15 BookImages — Hình ảnh bổ trợ (không lưu nội dung PDF công khai).
CREATE TABLE dbo.[BookImages] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BookImages PRIMARY KEY,
    [BookRowId] BIGINT NOT NULL,
    [ImageUrl] NVARCHAR(1000) NOT NULL,
    [AltText] NVARCHAR(250) NULL,
    [SortOrder] INT NOT NULL CONSTRAINT DF_BookImages_SortOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BookImages_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_BookImages_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BookImages_Version DEFAULT 1
);
GO

-- 7.16 WishlistItems — Sách yêu thích của từng Buyer.
CREATE TABLE dbo.[WishlistItems] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WishlistItems PRIMARY KEY,
    [BuyerRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_WishlistItems_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_WishlistItems_Version DEFAULT 1
);
GO

-- 7.17 BrowsingHistory — Lịch sử xem sách của Buyer phục vụ cá nhân hóa (tùy chọn cho AI).
CREATE TABLE dbo.[BrowsingHistory] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BrowsingHistory PRIMARY KEY,
    [BuyerRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [LastViewedAt] DATETIME2(3) NOT NULL,
    [ViewCount] INT NOT NULL CONSTRAINT DF_BrowsingHistory_ViewCount DEFAULT 1,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BrowsingHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NULL
);
GO

-- 7.18 Carts — Giỏ hàng đang hoạt động của một Buyer.
CREATE TABLE dbo.[Carts] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Carts PRIMARY KEY,
    [BuyerRowId] BIGINT NOT NULL,
    [CartStatus] VARCHAR(20) NOT NULL,
    [LastActivityAt] DATETIME2(3) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Carts_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Carts_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Carts_Version DEFAULT 1
);
GO

-- 7.19 CartItems — Một dòng sách lẻ hoặc Bundle gắn với một người nhận; mua lại qua giao dịch mới.
CREATE TABLE dbo.[CartItems] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CartItems PRIMARY KEY,
    [CartRowId] BIGINT NOT NULL,
    [ProductType] VARCHAR(10) NOT NULL,
    [BookRowId] BIGINT NULL,
    [BundleRowId] BIGINT NULL,
    [RecipientUserRowId] BIGINT NOT NULL,
    [GiftMessage] NVARCHAR(500) NULL,
    [Quantity] INT NOT NULL CONSTRAINT DF_CartItems_Quantity DEFAULT 1,
    [BundleRevisionRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_CartItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_CartItems_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_CartItems_Version DEFAULT 1
);
GO

-- 7.20 CartItemBooks — Các cuốn sách được chọn cho CartItem Bundle (không dùng cho BOOK đơn).
CREATE TABLE dbo.[CartItemBooks] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CartItemBooks PRIMARY KEY,
    [CartItemRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_CartItemBooks_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_CartItemBooks_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_CartItemBooks_Version DEFAULT 1
);
GO

-- 7.21 Orders — Đơn mua trực tuyến; hoàn tất tự động theo simulated payment, không duyệt bởi Admin.
CREATE TABLE dbo.[Orders] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    [OrderId] VARCHAR(40) NOT NULL,
    [BuyerRowId] BIGINT NOT NULL,
    [OrderStatus] VARCHAR(30) NOT NULL,
    [Currency] CHAR(3) NOT NULL CONSTRAINT DF_Orders_Currency DEFAULT 'VND',
    [BooksOriginalSubtotal] DECIMAL(18,2) NOT NULL,
    [BundleSubtotal] DECIMAL(18,2) NOT NULL,
    [DiscountSource] VARCHAR(12) NOT NULL,
    [CouponRowId] BIGINT NULL,
    [EventRowId] BIGINT NULL,
    [DiscountAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT 0,
    [TotalAmount] DECIMAL(18,2) NOT NULL,
    [PaidAt] DATETIME2(3) NULL,
    [CheckoutIdempotencyKey] VARCHAR(100) NOT NULL,
    [PriceSnapshotJson] NVARCHAR(MAX) NULL,
    [RequestHash] BINARY(32) NOT NULL,
    [CartRowId] BIGINT NOT NULL,
    [CouponRevisionRowId] BIGINT NULL,
    [EventRevisionRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Orders_Version DEFAULT 1
);
GO

-- 7.22 OrderItems — Dòng sản phẩm lẻ/Bundle; giá snapshot không bị thay đổi khi catalog được sửa.
CREATE TABLE dbo.[OrderItems] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
    [OrderRowId] BIGINT NOT NULL,
    [ProductType] VARCHAR(10) NOT NULL,
    [BookRowId] BIGINT NULL,
    [BundleRowId] BIGINT NULL,
    [RecipientUserRowId] BIGINT NOT NULL,
    [ProductNameSnapshot] NVARCHAR(300) NOT NULL,
    [OriginalUnitPrice] DECIMAL(18,2) NOT NULL,
    [FinalLineAmount] DECIMAL(18,2) NOT NULL,
    [LineDiscountAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_OrderItems_LineDiscountAmount DEFAULT 0,
    [DiscountSource] VARCHAR(12) NOT NULL,
    [GiftMessage] NVARCHAR(500) NULL,
    [Quantity] INT NOT NULL CONSTRAINT DF_OrderItems_Quantity DEFAULT 1,
    [BundleRevisionRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_OrderItems_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- 7.23 OrderItemBooks — Tập sách thực tế tạo quyền sở hữu trong mỗi OrderItem (BOOK và BUNDLE).
CREATE TABLE dbo.[OrderItemBooks] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItemBooks PRIMARY KEY,
    [OrderItemRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [BookTitleSnapshot] NVARCHAR(300) NOT NULL,
    [OriginalBookPriceSnapshot] DECIMAL(18,2) NOT NULL,
    [FromBundle] BIT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_OrderItemBooks_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- 7.24 PaymentAttempts — Các phiên thanh toán được backend tạo cho gateway giả lập.
CREATE TABLE dbo.[PaymentAttempts] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaymentAttempts PRIMARY KEY,
    [PaymentAttemptId] VARCHAR(50) NOT NULL,
    [OrderRowId] BIGINT NOT NULL,
    [GatewayReference] VARCHAR(80) NULL,
    [ExpiresAt] DATETIME2(3) NULL,
    [Amount] DECIMAL(18,2) NOT NULL,
    [Currency] CHAR(3) NOT NULL CONSTRAINT DF_PaymentAttempts_Currency DEFAULT 'VND',
    [Status] VARCHAR(20) NOT NULL,
    [StartedAt] DATETIME2(3) NOT NULL,
    [CompletedAt] DATETIME2(3) NULL,
    [FailureCode] VARCHAR(60) NULL,
    [PaymentType] VARCHAR(20) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentAttempts_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_PaymentAttempts_Version DEFAULT 1
);
GO

-- 7.25 PaymentGatewayEvents — Log append-only/idempotency của callback cổng thanh toán giả lập.
CREATE TABLE dbo.[PaymentGatewayEvents] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaymentGatewayEvents PRIMARY KEY,
    [GatewayEventId] VARCHAR(100) NOT NULL,
    [PaymentAttemptRowId] BIGINT NOT NULL,
    [GatewayStatus] VARCHAR(30) NOT NULL,
    [PayloadHash] CHAR(64) NULL,
    [ReceivedAt] DATETIME2(3) NOT NULL,
    [ProcessingResult] VARCHAR(30) NOT NULL,
    [ErrorSummary] NVARCHAR(500) NULL
);
GO

-- 7.26 OrderStatusHistory — Lịch sử thay đổi OrderStatus theo thời gian, độc lập AuditLog tổng quát.
CREATE TABLE dbo.[OrderStatusHistory] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderStatusHistory PRIMARY KEY,
    [OrderRowId] BIGINT NOT NULL,
    [OldStatus] VARCHAR(30) NULL,
    [NewStatus] VARCHAR(30) NOT NULL,
    [Reason] NVARCHAR(500) NULL,
    [ChangedBy] BIGINT NULL,
    [ChangedAt] DATETIME2(3) NOT NULL
);
GO

-- 7.27 DigitalEntitlements — Quyền đọc và tải một đầu sách cho một User.
CREATE TABLE dbo.[DigitalEntitlements] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DigitalEntitlements PRIMARY KEY,
    [UserRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [GrantedAt] DATETIME2(3) NOT NULL,
    [EntitlementStatus] VARCHAR(20) NOT NULL CONSTRAINT DF_DigitalEntitlements_EntitlementStatus DEFAULT 'ACTIVE',
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_DigitalEntitlements_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_DigitalEntitlements_Version DEFAULT 1
);
GO

-- 7.28 EntitlementSources — Nguồn chứng minh mỗi lần mua/tặng đã cấp hoặc tái sử dụng quyền.
CREATE TABLE dbo.[EntitlementSources] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EntitlementSources PRIMARY KEY,
    [EntitlementRowId] BIGINT NOT NULL,
    [OrderItemBookRowId] BIGINT NOT NULL,
    [SourceType] VARCHAR(20) NOT NULL,
    [GrantedAt] DATETIME2(3) NOT NULL
);
GO

-- 7.29 BookAccessLogs — Nhật ký đọc/tải PDF để hỗ trợ kiểm tra bảo mật và khiếu nại.
CREATE TABLE dbo.[BookAccessLogs] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BookAccessLogs PRIMARY KEY,
    [UserRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [AccessType] VARCHAR(20) NOT NULL,
    [AccessResult] VARCHAR(20) NOT NULL,
    [OccurredAt] DATETIME2(3) NOT NULL,
    [IpAddress] VARCHAR(45) NULL,
    [RequestId] VARCHAR(80) NULL
);
GO

-- 7.30 Bundles — Bundle sách PDF có giá cố định; FIXED: mua toàn bộ, FLEXIBLE: chọn đúng N trong M.
CREATE TABLE dbo.[Bundles] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bundles PRIMARY KEY,
    [BundleId] VARCHAR(30) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT DF_Bundles_IsActive DEFAULT 0,
    [CurrentRevisionRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Bundles_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Bundles_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Bundles_Version DEFAULT 1
);
GO

-- 7.31 BundleBooks — Danh sách tối đa M sách đủ điều kiện trong Bundle.
CREATE TABLE dbo.[BundleBooks] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BundleBooks PRIMARY KEY,
    [BundleRevisionRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [SortOrder] INT NOT NULL CONSTRAINT DF_BundleBooks_SortOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BundleBooks_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_BundleBooks_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BundleBooks_Version DEFAULT 1
);
GO

-- 7.32 Events — Sự kiện sale Book Sale/Tết với giao diện có sẵn và thời gian hiệu lực.
CREATE TABLE dbo.[Events] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Events PRIMARY KEY,
    [EventId] VARCHAR(30) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT DF_Events_IsActive DEFAULT 1,
    [ScheduledRevisionRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Events_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Events_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Events_Version DEFAULT 1
);
GO

-- 7.33 EventBooks — Sách được giới thiệu hoặc giảm trong Event, liên kết trực tiếp catalog.
CREATE TABLE dbo.[EventBooks] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventBooks PRIMARY KEY,
    [EventRevisionRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [SalePrice] DECIMAL(18,2) NULL,
    [IsFeatured] BIT NOT NULL CONSTRAINT DF_EventBooks_IsFeatured DEFAULT 0,
    [SortOrder] INT NOT NULL CONSTRAINT DF_EventBooks_SortOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_EventBooks_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_EventBooks_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_EventBooks_Version DEFAULT 1
);
GO

-- 7.34 EventBundles — Bundle đã duyệt tham gia Event với mục đích trưng bày/giới thiệu.
CREATE TABLE dbo.[EventBundles] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventBundles PRIMARY KEY,
    [EventRevisionRowId] BIGINT NOT NULL,
    [BundleRowId] BIGINT NOT NULL,
    [IsFeatured] BIT NOT NULL CONSTRAINT DF_EventBundles_IsFeatured DEFAULT 0,
    [SortOrder] INT NOT NULL CONSTRAINT DF_EventBundles_SortOrder DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_EventBundles_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_EventBundles_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_EventBundles_Version DEFAULT 1
);
GO

-- 7.35 Coupons — Coupon chung cho sách lẻ, tạo thủ công hoặc sinh ngẫu nhiên; cần Manager phê duyệt.
CREATE TABLE dbo.[Coupons] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Coupons PRIMARY KEY,
    [CouponId] VARCHAR(30) NOT NULL,
    [CouponCode] VARCHAR(50) NOT NULL,
    [GenerationMode] VARCHAR(15) NOT NULL,
    [CurrentRevisionRowId] BIGINT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT DF_Coupons_IsActive DEFAULT 1,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Coupons_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Coupons_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Coupons_Version DEFAULT 1
);
GO

-- 7.36 CouponUsages — Lưu reservation và lượt sử dụng Coupon theo Order, bảo đảm quota đồng thời.
CREATE TABLE dbo.[CouponUsages] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CouponUsages PRIMARY KEY,
    [CouponRowId] BIGINT NOT NULL,
    [OrderRowId] BIGINT NOT NULL,
    [BuyerRowId] BIGINT NOT NULL,
    [DiscountAmount] DECIMAL(18,2) NOT NULL,
    [UsageStatus] VARCHAR(20) NOT NULL,
    [ReservedAt] DATETIME2(3) NOT NULL,
    [ReservationExpiresAt] DATETIME2(3) NOT NULL,
    [ConsumedAt] DATETIME2(3) NULL,
    [ReleasedAt] DATETIME2(3) NULL,
    [CouponRevisionRowId] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_CouponUsages_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_CouponUsages_Version DEFAULT 1
);
GO

-- 7.37 Reviews — Đánh giá theo đầu sách của người nhận từ đơn PAID.
CREATE TABLE dbo.[Reviews] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reviews PRIMARY KEY,
    [ReviewId] VARCHAR(35) NULL,
    [BuyerRowId] BIGINT NOT NULL,
    [BookRowId] BIGINT NOT NULL,
    [VerifiedOrderItemBookRowId] BIGINT NOT NULL,
    [Rating] TINYINT NOT NULL,
    [Content] NVARCHAR(4000) NOT NULL,
    [ReviewStatus] VARCHAR(20) NOT NULL,
    [EditCount] INT NOT NULL CONSTRAINT DF_Reviews_EditCount DEFAULT 0,
    [LastEditedAt] DATETIME2(3) NULL,
    [HiddenBy] BIGINT NULL,
    [HiddenAt] DATETIME2(3) NULL,
    [HideReason] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Reviews_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Reviews_Version DEFAULT 1
);
GO

-- 7.38 ContentReports — Buyer báo cáo nội dung vi phạm (ví dụ review, sách), Employee/Manager xử lý.
CREATE TABLE dbo.[ContentReports] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContentReports PRIMARY KEY,
    [ReportId] VARCHAR(40) NOT NULL,
    [ReporterUserRowId] BIGINT NOT NULL,
    [TargetType] VARCHAR(25) NOT NULL,
    [TargetRowId] BIGINT NOT NULL,
    [ReasonCode] VARCHAR(30) NOT NULL,
    [Description] NVARCHAR(2000) NULL,
    [ReportStatus] VARCHAR(25) NOT NULL,
    [HandledBy] BIGINT NULL,
    [HandledAt] DATETIME2(3) NULL,
    [ResolutionNote] NVARCHAR(2000) NULL,
    [TargetSnapshotJson] NVARCHAR(MAX) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_ContentReports_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_ContentReports_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_ContentReports_Version DEFAULT 1
);
GO

-- 7.39 Complaints — Yêu cầu hỗ trợ/khiếu nại, không có luồng hoàn tiền.
CREATE TABLE dbo.[Complaints] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Complaints PRIMARY KEY,
    [ComplaintId] VARCHAR(40) NOT NULL,
    [BuyerRowId] BIGINT NOT NULL,
    [OrderRowId] BIGINT NULL,
    [Category] VARCHAR(30) NOT NULL,
    [Subject] NVARCHAR(250) NOT NULL,
    [Description] NVARCHAR(4000) NOT NULL,
    [ComplaintStatus] VARCHAR(25) NOT NULL,
    [AssignedTo] BIGINT NULL,
    [ResolvedAt] DATETIME2(3) NULL,
    [ResolutionNote] NVARCHAR(2000) NULL,
    [EntitlementSourceRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_Complaints_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_Complaints_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_Complaints_Version DEFAULT 1
);
GO

-- 7.40 ComplaintMessages — Luồng trao đổi hỗ trợ giữa Buyer và Admin.
CREATE TABLE dbo.[ComplaintMessages] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ComplaintMessages PRIMARY KEY,
    [ComplaintRowId] BIGINT NOT NULL,
    [SenderUserRowId] BIGINT NOT NULL,
    [MessageText] NVARCHAR(4000) NOT NULL,
    [IsInternalNote] BIT NOT NULL CONSTRAINT DF_ComplaintMessages_IsInternalNote DEFAULT 0,
    [SentAt] DATETIME2(3) NOT NULL,
    [AttachmentUrl] NVARCHAR(1000) NULL
);
GO

-- 7.41 AIConversations — Phiên trò chuyện của Buyer/Employee/Manager.
CREATE TABLE dbo.[AIConversations] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIConversations PRIMARY KEY,
    [OwnerUserRowId] BIGINT NULL,
    [AssistantType] VARCHAR(20) NOT NULL,
    [ConversationTitle] NVARCHAR(200) NULL,
    [LastMessageAt] DATETIME2(3) NULL,
    [ConversationStatus] VARCHAR(20) NOT NULL,
    [GuestSessionHash] BINARY(32) NULL,
    [ExpiresAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_AIConversations_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_AIConversations_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_AIConversations_Version DEFAULT 1
);
GO

-- 7.42 AIMessages — Tin nhắn trong một AI conversation.
CREATE TABLE dbo.[AIMessages] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIMessages PRIMARY KEY,
    [ConversationRowId] BIGINT NOT NULL,
    [MessageRole] VARCHAR(20) NOT NULL,
    [Content] NVARCHAR(MAX) NOT NULL,
    [ModelName] VARCHAR(100) NULL,
    [TokenCount] INT NULL,
    [SentAt] DATETIME2(3) NOT NULL
);
GO

-- 7.43 AIActionLogs — Lịch sử AI gọi tool và yêu cầu thao tác nghiệp vụ.
CREATE TABLE dbo.[AIActionLogs] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIActionLogs PRIMARY KEY,
    [ConversationRowId] BIGINT NOT NULL,
    [InitiatorUserRowId] BIGINT NULL,
    [ToolName] VARCHAR(100) NOT NULL,
    [ActionType] VARCHAR(20) NOT NULL,
    [TargetTable] VARCHAR(80) NULL,
    [TargetRowId] BIGINT NULL,
    [RequestId] VARCHAR(80) NOT NULL,
    [ConfirmationStatus] VARCHAR(20) NOT NULL,
    [ExecutionStatus] VARCHAR(20) NOT NULL,
    [ResultSummary] NVARCHAR(1000) NULL,
    [ActionRequestRowId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_AIActionLogs_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- 7.44 KnowledgeArticles — Tri thức hướng dẫn quy trình nội bộ cho AI Employee/Manager.
CREATE TABLE dbo.[KnowledgeArticles] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KnowledgeArticles PRIMARY KEY,
    [ArticleCode] VARCHAR(40) NOT NULL,
    [Title] NVARCHAR(250) NOT NULL,
    [Content] NVARCHAR(MAX) NOT NULL,
    [AudienceRole] VARCHAR(20) NOT NULL,
    [ArticleStatus] VARCHAR(20) NOT NULL,
    [ReviewedBy] BIGINT NULL,
    [ReviewedAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_KnowledgeArticles_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_KnowledgeArticles_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_KnowledgeArticles_Version DEFAULT 1
);
GO

-- 7.45 AuditLogs — Audit tập trung ai làm gì ở bảng nào; lưu old/new có mask, đa số thay đổi nghiệp vụ.
CREATE TABLE dbo.[AuditLogs] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
    [ActorUserRowId] BIGINT NULL,
    [ActorType] VARCHAR(15) NOT NULL,
    [ActorRoleSnapshot] VARCHAR(20) NULL,
    [ActionSource] VARCHAR(15) NOT NULL,
    [ActionCode] VARCHAR(100) NOT NULL,
    [TableName] VARCHAR(80) NULL,
    [RecordRowId] BIGINT NULL,
    [OldValuesJson] NVARCHAR(MAX) NULL,
    [NewValuesJson] NVARCHAR(MAX) NULL,
    [ChangedFieldsJson] NVARCHAR(MAX) NULL,
    [Description] NVARCHAR(1000) NULL,
    [OccurredAt] DATETIME2(3) NOT NULL,
    [RequestId] VARCHAR(80) NULL,
    [IpAddress] VARCHAR(45) NULL,
    [Result] VARCHAR(20) NOT NULL
);
GO

-- 7.46 SystemLogs — Log lỗi, cảnh báo, sức khỏe kỹ thuật; không thay thế audit nghiệp vụ.
CREATE TABLE dbo.[SystemLogs] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SystemLogs PRIMARY KEY,
    [LogLevel] VARCHAR(12) NOT NULL,
    [ServiceName] VARCHAR(80) NOT NULL,
    [Message] NVARCHAR(2000) NOT NULL,
    [ExceptionCode] VARCHAR(100) NULL,
    [RequestId] VARCHAR(80) NULL,
    [OccurredAt] DATETIME2(3) NOT NULL
);
GO

-- 7.47 SystemSettings — Cấu hình kiểm soát được (không chứa secret); chỉ Manager thay đổi.
CREATE TABLE dbo.[SystemSettings] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SystemSettings PRIMARY KEY,
    [SettingKey] VARCHAR(100) NOT NULL,
    [SettingValueJson] NVARCHAR(MAX) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [IsPublic] BIT NOT NULL CONSTRAINT DF_SystemSettings_IsPublic DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_SystemSettings_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [IsDel] BIT NOT NULL CONSTRAINT DF_SystemSettings_IsDel DEFAULT 0,
    [DeletedAt] DATETIME2(3) NULL,
    [DeletedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_SystemSettings_Version DEFAULT 1
);
GO

-- 7.48 BundleRevisions
CREATE TABLE dbo.[BundleRevisions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BundleRevisions PRIMARY KEY,
    [BundleRowId] BIGINT NOT NULL,
    [RevisionNo] INT NOT NULL,
    [BundleName] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(MAX) NULL,
    [BundleType] VARCHAR(20) NOT NULL,
    [RequiredSelectionCount] INT NOT NULL,
    [BundlePrice] DECIMAL(18,2) NOT NULL,
    [CoverImageUrl] NVARCHAR(1000) NULL,
    [ApprovalStatus] VARCHAR(25) NOT NULL,
    [ApprovedBy] BIGINT NULL,
    [ApprovedAt] DATETIME2(3) NULL,
    [RejectionReason] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_BundleRevisions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_BundleRevisions_Version DEFAULT 1
);
GO

-- 7.49 EventRevisions
CREATE TABLE dbo.[EventRevisions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventRevisions PRIMARY KEY,
    [EventRowId] BIGINT NOT NULL,
    [RevisionNo] INT NOT NULL,
    [EventName] NVARCHAR(200) NOT NULL,
    [EventType] VARCHAR(25) NOT NULL,
    [Description] NVARCHAR(MAX) NULL,
    [StartAt] DATETIME2(3) NOT NULL,
    [EndAt] DATETIME2(3) NOT NULL,
    [ThemePresetCode] VARCHAR(30) NOT NULL,
    [HeroBannerUrl] NVARCHAR(1000) NULL,
    [BackgroundImageUrl] NVARCHAR(1000) NULL,
    [ThemeConfigJson] NVARCHAR(MAX) NULL,
    [ApprovalStatus] VARCHAR(25) NOT NULL,
    [ApprovedBy] BIGINT NULL,
    [ApprovedAt] DATETIME2(3) NULL,
    [RejectionReason] NVARCHAR(500) NULL,
    [IsSelected] BIT NOT NULL CONSTRAINT DF_EventRevisions_IsSelected DEFAULT 0,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_EventRevisions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_EventRevisions_Version DEFAULT 1
);
GO

-- 7.50 CouponRevisions
CREATE TABLE dbo.[CouponRevisions] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CouponRevisions PRIMARY KEY,
    [CouponRowId] BIGINT NOT NULL,
    [RevisionNo] INT NOT NULL,
    [CouponName] NVARCHAR(200) NOT NULL,
    [DiscountType] VARCHAR(15) NOT NULL,
    [DiscountValue] DECIMAL(18,2) NOT NULL,
    [MaxDiscountAmount] DECIMAL(18,2) NULL,
    [MinimumBooksSubtotal] DECIMAL(18,2) NOT NULL CONSTRAINT DF_CouponRevisions_MinimumBooksSubtotal DEFAULT 0,
    [UsageLimitTotal] INT NULL,
    [UsageLimitPerBuyer] INT NULL,
    [StartAt] DATETIME2(3) NOT NULL,
    [EndAt] DATETIME2(3) NOT NULL,
    [ApprovalStatus] VARCHAR(25) NOT NULL,
    [ApprovedBy] BIGINT NULL,
    [ApprovedAt] DATETIME2(3) NULL,
    [RejectionReason] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_CouponRevisions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_CouponRevisions_Version DEFAULT 1
);
GO

-- 7.51 AIActionRequests
CREATE TABLE dbo.[AIActionRequests] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIActionRequests PRIMARY KEY,
    [InitiatorUserRowId] BIGINT NOT NULL,
    [ConversationRowId] BIGINT NOT NULL,
    [ToolName] VARCHAR(100) NOT NULL,
    [TargetTable] VARCHAR(100) NOT NULL,
    [TargetRowId] BIGINT NULL,
    [ExpectedVersion] INT NULL,
    [PayloadJson] NVARCHAR(MAX) NOT NULL,
    [PayloadHash] BINARY(32) NOT NULL,
    [TokenHash] BINARY(32) NOT NULL,
    [ExpiresAt] DATETIME2(3) NOT NULL,
    [RequestStatus] VARCHAR(20) NOT NULL,
    [RequestId] VARCHAR(80) NOT NULL,
    [CompletedAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_AIActionRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
    [CreatedBy] BIGINT NULL,
    [UpdatedAt] DATETIME2(3) NULL,
    [UpdatedBy] BIGINT NULL,
    [Version] INT NOT NULL CONSTRAINT DF_AIActionRequests_Version DEFAULT 1
);
GO

-- 7.52 OutboxMessages
CREATE TABLE dbo.[OutboxMessages] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OutboxMessages PRIMARY KEY,
    [MessageKey] VARCHAR(120) NOT NULL,
    [EventType] VARCHAR(50) NOT NULL,
    [PayloadJson] NVARCHAR(MAX) NOT NULL,
    [DeliveryStatus] VARCHAR(15) NOT NULL,
    [RetryCount] INT NOT NULL CONSTRAINT DF_OutboxMessages_RetryCount DEFAULT 0,
    [AvailableAt] DATETIME2(3) NOT NULL,
    [LeaseUntil] DATETIME2(3) NULL,
    [SentAt] DATETIME2(3) NULL,
    [LastError] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT DF_OutboxMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NULL
);
GO

-- 7.53 PaymentCallbackReceipts
CREATE TABLE dbo.[PaymentCallbackReceipts] (
    [RowId] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaymentCallbackReceipts PRIMARY KEY,
    [ReceivedAt] DATETIME2(3) NOT NULL,
    [RequestId] VARCHAR(80) NOT NULL,
    [PresentedEventId] VARCHAR(100) NULL,
    [GatewayEventRowId] BIGINT NULL,
    [PayloadHash] BINARY(32) NULL,
    [Disposition] VARCHAR(24) NOT NULL,
    [ReasonCode] VARCHAR(60) NULL
);
GO

-- ====================== (B) KHÓA NGOẠI ======================

ALTER TABLE dbo.[RolePermissions] ADD CONSTRAINT FK_RolePermissions_RoleRowId FOREIGN KEY ([RoleRowId]) REFERENCES dbo.[Roles] ([RowId]);
ALTER TABLE dbo.[RolePermissions] ADD CONSTRAINT FK_RolePermissions_PermissionRowId FOREIGN KEY ([PermissionRowId]) REFERENCES dbo.[Permissions] ([RowId]);
ALTER TABLE dbo.[Users] ADD CONSTRAINT FK_Users_RoleRowId FOREIGN KEY ([RoleRowId]) REFERENCES dbo.[Roles] ([RowId]);
ALTER TABLE dbo.[Users] ADD CONSTRAINT FK_Users_DisabledBy FOREIGN KEY ([DisabledBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[UserSessions] ADD CONSTRAINT FK_UserSessions_UserRowId FOREIGN KEY ([UserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[PasswordResetRequests] ADD CONSTRAINT FK_PasswordResetRequests_UserRowId FOREIGN KEY ([UserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Notifications] ADD CONSTRAINT FK_Notifications_RecipientUserRowId FOREIGN KEY ([RecipientUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT FK_Books_PublisherRowId FOREIGN KEY ([PublisherRowId]) REFERENCES dbo.[Publishers] ([RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT FK_Books_SuspendedBy FOREIGN KEY ([SuspendedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT FK_BookFiles_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT FK_BookFiles_UploadedBy FOREIGN KEY ([UploadedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Categories] ADD CONSTRAINT FK_Categories_ParentCategoryRowId FOREIGN KEY ([ParentCategoryRowId]) REFERENCES dbo.[Categories] ([RowId]);
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT FK_BookAuthors_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT FK_BookAuthors_AuthorRowId FOREIGN KEY ([AuthorRowId]) REFERENCES dbo.[Authors] ([RowId]);
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT FK_BookCategories_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT FK_BookCategories_CategoryRowId FOREIGN KEY ([CategoryRowId]) REFERENCES dbo.[Categories] ([RowId]);
ALTER TABLE dbo.[BookImages] ADD CONSTRAINT FK_BookImages_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT FK_WishlistItems_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT FK_WishlistItems_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[BrowsingHistory] ADD CONSTRAINT FK_BrowsingHistory_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BrowsingHistory] ADD CONSTRAINT FK_BrowsingHistory_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[Carts] ADD CONSTRAINT FK_Carts_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_CartRowId FOREIGN KEY ([CartRowId]) REFERENCES dbo.[Carts] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_BundleRowId FOREIGN KEY ([BundleRowId]) REFERENCES dbo.[Bundles] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_RecipientUserRowId FOREIGN KEY ([RecipientUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_BundleRevisionRowId FOREIGN KEY ([BundleRevisionRowId]) REFERENCES dbo.[BundleRevisions] ([RowId]);
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT FK_CartItemBooks_CartItemRowId FOREIGN KEY ([CartItemRowId]) REFERENCES dbo.[CartItems] ([RowId]);
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT FK_CartItemBooks_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_CouponRowId FOREIGN KEY ([CouponRowId]) REFERENCES dbo.[Coupons] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_EventRowId FOREIGN KEY ([EventRowId]) REFERENCES dbo.[Events] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_CartRowId FOREIGN KEY ([CartRowId]) REFERENCES dbo.[Carts] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_CouponRevisionRowId FOREIGN KEY ([CouponRevisionRowId]) REFERENCES dbo.[CouponRevisions] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_EventRevisionRowId FOREIGN KEY ([EventRevisionRowId]) REFERENCES dbo.[EventRevisions] ([RowId]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT FK_OrderItems_OrderRowId FOREIGN KEY ([OrderRowId]) REFERENCES dbo.[Orders] ([RowId]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT FK_OrderItems_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT FK_OrderItems_BundleRowId FOREIGN KEY ([BundleRowId]) REFERENCES dbo.[Bundles] ([RowId]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT FK_OrderItems_RecipientUserRowId FOREIGN KEY ([RecipientUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT FK_OrderItems_BundleRevisionRowId FOREIGN KEY ([BundleRevisionRowId]) REFERENCES dbo.[BundleRevisions] ([RowId]);
ALTER TABLE dbo.[OrderItemBooks] ADD CONSTRAINT FK_OrderItemBooks_OrderItemRowId FOREIGN KEY ([OrderItemRowId]) REFERENCES dbo.[OrderItems] ([RowId]);
ALTER TABLE dbo.[OrderItemBooks] ADD CONSTRAINT FK_OrderItemBooks_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT FK_PaymentAttempts_OrderRowId FOREIGN KEY ([OrderRowId]) REFERENCES dbo.[Orders] ([RowId]);
ALTER TABLE dbo.[PaymentGatewayEvents] ADD CONSTRAINT FK_PaymentGatewayEvents_PaymentAttemptRowId FOREIGN KEY ([PaymentAttemptRowId]) REFERENCES dbo.[PaymentAttempts] ([RowId]);
ALTER TABLE dbo.[OrderStatusHistory] ADD CONSTRAINT FK_OrderStatusHistory_OrderRowId FOREIGN KEY ([OrderRowId]) REFERENCES dbo.[Orders] ([RowId]);
ALTER TABLE dbo.[OrderStatusHistory] ADD CONSTRAINT FK_OrderStatusHistory_ChangedBy FOREIGN KEY ([ChangedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[DigitalEntitlements] ADD CONSTRAINT FK_DigitalEntitlements_UserRowId FOREIGN KEY ([UserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[DigitalEntitlements] ADD CONSTRAINT FK_DigitalEntitlements_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[EntitlementSources] ADD CONSTRAINT FK_EntitlementSources_EntitlementRowId FOREIGN KEY ([EntitlementRowId]) REFERENCES dbo.[DigitalEntitlements] ([RowId]);
ALTER TABLE dbo.[EntitlementSources] ADD CONSTRAINT FK_EntitlementSources_OrderItemBookRowId FOREIGN KEY ([OrderItemBookRowId]) REFERENCES dbo.[OrderItemBooks] ([RowId]);
ALTER TABLE dbo.[BookAccessLogs] ADD CONSTRAINT FK_BookAccessLogs_UserRowId FOREIGN KEY ([UserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookAccessLogs] ADD CONSTRAINT FK_BookAccessLogs_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT FK_BundleBooks_BundleRevisionRowId FOREIGN KEY ([BundleRevisionRowId]) REFERENCES dbo.[BundleRevisions] ([RowId]);
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT FK_BundleBooks_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT FK_EventBooks_EventRevisionRowId FOREIGN KEY ([EventRevisionRowId]) REFERENCES dbo.[EventRevisions] ([RowId]);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT FK_EventBooks_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT FK_EventBundles_EventRevisionRowId FOREIGN KEY ([EventRevisionRowId]) REFERENCES dbo.[EventRevisions] ([RowId]);
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT FK_EventBundles_BundleRowId FOREIGN KEY ([BundleRowId]) REFERENCES dbo.[Bundles] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_CouponRowId FOREIGN KEY ([CouponRowId]) REFERENCES dbo.[Coupons] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_OrderRowId FOREIGN KEY ([OrderRowId]) REFERENCES dbo.[Orders] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_CouponRevisionRowId FOREIGN KEY ([CouponRevisionRowId]) REFERENCES dbo.[CouponRevisions] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_BookRowId FOREIGN KEY ([BookRowId]) REFERENCES dbo.[Books] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_VerifiedOrderItemBookRowId FOREIGN KEY ([VerifiedOrderItemBookRowId]) REFERENCES dbo.[OrderItemBooks] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_HiddenBy FOREIGN KEY ([HiddenBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT FK_ContentReports_ReporterUserRowId FOREIGN KEY ([ReporterUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT FK_ContentReports_HandledBy FOREIGN KEY ([HandledBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_BuyerRowId FOREIGN KEY ([BuyerRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_OrderRowId FOREIGN KEY ([OrderRowId]) REFERENCES dbo.[Orders] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_AssignedTo FOREIGN KEY ([AssignedTo]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_EntitlementSourceRowId FOREIGN KEY ([EntitlementSourceRowId]) REFERENCES dbo.[EntitlementSources] ([RowId]);
ALTER TABLE dbo.[ComplaintMessages] ADD CONSTRAINT FK_ComplaintMessages_ComplaintRowId FOREIGN KEY ([ComplaintRowId]) REFERENCES dbo.[Complaints] ([RowId]);
ALTER TABLE dbo.[ComplaintMessages] ADD CONSTRAINT FK_ComplaintMessages_SenderUserRowId FOREIGN KEY ([SenderUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT FK_AIConversations_OwnerUserRowId FOREIGN KEY ([OwnerUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIMessages] ADD CONSTRAINT FK_AIMessages_ConversationRowId FOREIGN KEY ([ConversationRowId]) REFERENCES dbo.[AIConversations] ([RowId]);
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT FK_AIActionLogs_ConversationRowId FOREIGN KEY ([ConversationRowId]) REFERENCES dbo.[AIConversations] ([RowId]);
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT FK_AIActionLogs_InitiatorUserRowId FOREIGN KEY ([InitiatorUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT FK_AIActionLogs_ActionRequestRowId FOREIGN KEY ([ActionRequestRowId]) REFERENCES dbo.[AIActionRequests] ([RowId]);
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT FK_KnowledgeArticles_ReviewedBy FOREIGN KEY ([ReviewedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT FK_AuditLogs_ActorUserRowId FOREIGN KEY ([ActorUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT FK_BundleRevisions_BundleRowId FOREIGN KEY ([BundleRowId]) REFERENCES dbo.[Bundles] ([RowId]);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT FK_BundleRevisions_ApprovedBy FOREIGN KEY ([ApprovedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT FK_EventRevisions_EventRowId FOREIGN KEY ([EventRowId]) REFERENCES dbo.[Events] ([RowId]);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT FK_EventRevisions_ApprovedBy FOREIGN KEY ([ApprovedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT FK_CouponRevisions_CouponRowId FOREIGN KEY ([CouponRowId]) REFERENCES dbo.[Coupons] ([RowId]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT FK_CouponRevisions_ApprovedBy FOREIGN KEY ([ApprovedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT FK_AIActionRequests_InitiatorUserRowId FOREIGN KEY ([InitiatorUserRowId]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT FK_AIActionRequests_ConversationRowId FOREIGN KEY ([ConversationRowId]) REFERENCES dbo.[AIConversations] ([RowId]);
ALTER TABLE dbo.[PaymentCallbackReceipts] ADD CONSTRAINT FK_PaymentCallbackReceipts_GatewayEventRowId FOREIGN KEY ([GatewayEventRowId]) REFERENCES dbo.[PaymentGatewayEvents] ([RowId]);
ALTER TABLE dbo.[Roles] ADD CONSTRAINT FK_Roles_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Roles] ADD CONSTRAINT FK_Roles_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Roles] ADD CONSTRAINT FK_Roles_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Permissions] ADD CONSTRAINT FK_Permissions_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Permissions] ADD CONSTRAINT FK_Permissions_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Permissions] ADD CONSTRAINT FK_Permissions_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[RolePermissions] ADD CONSTRAINT FK_RolePermissions_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Users] ADD CONSTRAINT FK_Users_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Users] ADD CONSTRAINT FK_Users_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Users] ADD CONSTRAINT FK_Users_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT FK_Books_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT FK_Books_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT FK_Books_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT FK_BookFiles_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT FK_BookFiles_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT FK_BookFiles_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Authors] ADD CONSTRAINT FK_Authors_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Authors] ADD CONSTRAINT FK_Authors_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Authors] ADD CONSTRAINT FK_Authors_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Publishers] ADD CONSTRAINT FK_Publishers_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Publishers] ADD CONSTRAINT FK_Publishers_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Publishers] ADD CONSTRAINT FK_Publishers_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Categories] ADD CONSTRAINT FK_Categories_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Categories] ADD CONSTRAINT FK_Categories_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Categories] ADD CONSTRAINT FK_Categories_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT FK_BookAuthors_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT FK_BookAuthors_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT FK_BookAuthors_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT FK_BookCategories_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT FK_BookCategories_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT FK_BookCategories_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookImages] ADD CONSTRAINT FK_BookImages_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookImages] ADD CONSTRAINT FK_BookImages_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BookImages] ADD CONSTRAINT FK_BookImages_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT FK_WishlistItems_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT FK_WishlistItems_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT FK_WishlistItems_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Carts] ADD CONSTRAINT FK_Carts_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Carts] ADD CONSTRAINT FK_Carts_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Carts] ADD CONSTRAINT FK_Carts_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT FK_CartItems_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT FK_CartItemBooks_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT FK_CartItemBooks_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT FK_CartItemBooks_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT FK_Orders_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT FK_PaymentAttempts_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT FK_PaymentAttempts_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[DigitalEntitlements] ADD CONSTRAINT FK_DigitalEntitlements_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[DigitalEntitlements] ADD CONSTRAINT FK_DigitalEntitlements_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Bundles] ADD CONSTRAINT FK_Bundles_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Bundles] ADD CONSTRAINT FK_Bundles_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Bundles] ADD CONSTRAINT FK_Bundles_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT FK_BundleBooks_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT FK_BundleBooks_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT FK_BundleBooks_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Events] ADD CONSTRAINT FK_Events_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Events] ADD CONSTRAINT FK_Events_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Events] ADD CONSTRAINT FK_Events_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT FK_EventBooks_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT FK_EventBooks_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT FK_EventBooks_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT FK_EventBundles_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT FK_EventBundles_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT FK_EventBundles_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT FK_Coupons_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT FK_Coupons_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT FK_Coupons_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT FK_CouponUsages_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT FK_Reviews_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT FK_ContentReports_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT FK_ContentReports_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT FK_ContentReports_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT FK_Complaints_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT FK_AIConversations_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT FK_AIConversations_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT FK_AIConversations_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT FK_KnowledgeArticles_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT FK_KnowledgeArticles_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT FK_KnowledgeArticles_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[SystemSettings] ADD CONSTRAINT FK_SystemSettings_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[SystemSettings] ADD CONSTRAINT FK_SystemSettings_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[SystemSettings] ADD CONSTRAINT FK_SystemSettings_DeletedBy FOREIGN KEY ([DeletedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT FK_BundleRevisions_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT FK_BundleRevisions_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT FK_EventRevisions_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT FK_EventRevisions_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT FK_CouponRevisions_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT FK_CouponRevisions_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT FK_AIActionRequests_CreatedBy FOREIGN KEY ([CreatedBy]) REFERENCES dbo.[Users] ([RowId]);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT FK_AIActionRequests_UpdatedBy FOREIGN KEY ([UpdatedBy]) REFERENCES dbo.[Users] ([RowId]);
GO
-- FK ghép: bản đang áp dụng/đặt lịch phải thuộc đúng đối tượng gốc
ALTER TABLE dbo.[Bundles] ADD CONSTRAINT FK_Bundles_CurrentRevisionRowId FOREIGN KEY ([RowId], [CurrentRevisionRowId]) REFERENCES dbo.[BundleRevisions] ([BundleRowId], [RowId]);
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT FK_Coupons_CurrentRevisionRowId FOREIGN KEY ([RowId], [CurrentRevisionRowId]) REFERENCES dbo.[CouponRevisions] ([CouponRowId], [RowId]);
ALTER TABLE dbo.[Events] ADD CONSTRAINT FK_Events_ScheduledRevisionRowId FOREIGN KEY ([RowId], [ScheduledRevisionRowId]) REFERENCES dbo.[EventRevisions] ([EventRowId], [RowId]);
GO

-- ====================== (C) UNIQUE VÀ INDEX ======================

CREATE UNIQUE INDEX UQ_Roles_RoleCode ON dbo.[Roles] ([RoleCode]);
CREATE UNIQUE INDEX UQ_Permissions_PermissionCode ON dbo.[Permissions] ([PermissionCode]);
CREATE UNIQUE INDEX UQ_Users_UserId ON dbo.[Users] ([UserId]);
CREATE UNIQUE INDEX UQ_Users_Email_Normalized ON dbo.[Users] ([NormalizedEmail]);
CREATE UNIQUE INDEX UQ_UserSessions_RefreshTokenHash ON dbo.[UserSessions] ([RefreshTokenHash]);
CREATE UNIQUE INDEX UQ_PasswordResetRequests_TokenHash ON dbo.[PasswordResetRequests] ([TokenHash]);
CREATE UNIQUE INDEX UQ_Notifications_MessageKey ON dbo.[Notifications] ([MessageKey]) WHERE [MessageKey] IS NOT NULL;
CREATE UNIQUE INDEX UQ_Books_BookId ON dbo.[Books] ([BookId]);
CREATE UNIQUE INDEX UQ_BookFiles_StorageKey ON dbo.[BookFiles] ([StorageKey]);
CREATE UNIQUE INDEX UQ_Authors_AuthorCode ON dbo.[Authors] ([AuthorCode]) WHERE [AuthorCode] IS NOT NULL;
CREATE UNIQUE INDEX UQ_Publishers_PublisherCode ON dbo.[Publishers] ([PublisherCode]) WHERE [PublisherCode] IS NOT NULL;
CREATE UNIQUE INDEX UQ_Categories_CategoryCode ON dbo.[Categories] ([CategoryCode]);
CREATE UNIQUE INDEX UQ_Orders_OrderId ON dbo.[Orders] ([OrderId]);
CREATE UNIQUE INDEX UQ_Orders_Cart ON dbo.[Orders] ([CartRowId]);
CREATE UNIQUE INDEX UQ_PaymentAttempts_PaymentAttemptId ON dbo.[PaymentAttempts] ([PaymentAttemptId]);
CREATE UNIQUE INDEX UQ_PaymentAttempts_GatewayReference ON dbo.[PaymentAttempts] ([GatewayReference]) WHERE [GatewayReference] IS NOT NULL;
CREATE UNIQUE INDEX UQ_PaymentGatewayEvents_GatewayEventId ON dbo.[PaymentGatewayEvents] ([GatewayEventId]);
CREATE UNIQUE INDEX UQ_EntitlementSources_OrderItemBook ON dbo.[EntitlementSources] ([OrderItemBookRowId]);
CREATE UNIQUE INDEX UQ_Bundles_BundleId ON dbo.[Bundles] ([BundleId]);
CREATE UNIQUE INDEX UQ_Events_EventId ON dbo.[Events] ([EventId]);
CREATE UNIQUE INDEX UQ_Coupons_CouponId ON dbo.[Coupons] ([CouponId]);
CREATE UNIQUE INDEX UQ_Coupons_CouponCode ON dbo.[Coupons] ([CouponCode]);
CREATE UNIQUE INDEX UQ_CouponUsages_Order ON dbo.[CouponUsages] ([OrderRowId]);
CREATE UNIQUE INDEX UQ_Reviews_ReviewId ON dbo.[Reviews] ([ReviewId]) WHERE [ReviewId] IS NOT NULL;
CREATE UNIQUE INDEX UQ_ContentReports_ReportId ON dbo.[ContentReports] ([ReportId]);
CREATE UNIQUE INDEX UQ_Complaints_ComplaintId ON dbo.[Complaints] ([ComplaintId]);
CREATE UNIQUE INDEX UQ_KnowledgeArticles_ArticleCode ON dbo.[KnowledgeArticles] ([ArticleCode]);
CREATE UNIQUE INDEX UQ_SystemSettings_SettingKey ON dbo.[SystemSettings] ([SettingKey]);
CREATE UNIQUE INDEX UQ_AIActionRequests_TokenHash ON dbo.[AIActionRequests] ([TokenHash]);
CREATE UNIQUE INDEX UQ_OutboxMessages_MessageKey ON dbo.[OutboxMessages] ([MessageKey]);
CREATE UNIQUE INDEX UQ_RolePermissions_Role_Permission ON dbo.[RolePermissions] ([RoleRowId], [PermissionRowId]);
CREATE UNIQUE INDEX UQ_BookFiles_Book_Version ON dbo.[BookFiles] ([BookRowId], [FileVersion]);
CREATE UNIQUE INDEX UQ_BookFiles_CurrentPerBook ON dbo.[BookFiles] ([BookRowId]) WHERE [IsCurrent] = 1;
CREATE UNIQUE INDEX UQ_BookAuthors_ActivePair ON dbo.[BookAuthors] ([BookRowId], [AuthorRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_BookCategories_ActivePair ON dbo.[BookCategories] ([BookRowId], [CategoryRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_WishlistItems_ActivePair ON dbo.[WishlistItems] ([BuyerRowId], [BookRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_BrowsingHistory_Buyer_Book ON dbo.[BrowsingHistory] ([BuyerRowId], [BookRowId]);
CREATE UNIQUE INDEX UQ_Carts_ActiveBuyer ON dbo.[Carts] ([BuyerRowId]) WHERE [CartStatus] = 'ACTIVE' AND [IsDel] = 0;
CREATE UNIQUE INDEX UQ_CartItemBooks_ActivePair ON dbo.[CartItemBooks] ([CartItemRowId], [BookRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_Orders_Idempotency ON dbo.[Orders] ([BuyerRowId], [CheckoutIdempotencyKey]);
CREATE UNIQUE INDEX UQ_OrderItemBooks_OrderItem_Book ON dbo.[OrderItemBooks] ([OrderItemRowId], [BookRowId]);
CREATE UNIQUE INDEX UQ_DigitalEntitlements_User_Book ON dbo.[DigitalEntitlements] ([UserRowId], [BookRowId]);
CREATE UNIQUE INDEX UQ_BundleBooks_ActivePair ON dbo.[BundleBooks] ([BundleRevisionRowId], [BookRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_EventBooks_ActivePair ON dbo.[EventBooks] ([EventRevisionRowId], [BookRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_EventBundles_ActivePair ON dbo.[EventBundles] ([EventRevisionRowId], [BundleRowId]) WHERE [IsDel] = 0;
CREATE UNIQUE INDEX UQ_Reviews_Buyer_Book ON dbo.[Reviews] ([BuyerRowId], [BookRowId]);
CREATE UNIQUE INDEX UQ_AIConversations_GuestSessionHash ON dbo.[AIConversations] ([GuestSessionHash]) WHERE [GuestSessionHash] IS NOT NULL;
CREATE UNIQUE INDEX UQ_BundleRevisions_Bundle_Rev ON dbo.[BundleRevisions] ([BundleRowId], [RevisionNo]);
CREATE UNIQUE INDEX UQ_BundleRevisions_Bundle_Row ON dbo.[BundleRevisions] ([BundleRowId], [RowId]);
CREATE UNIQUE INDEX UQ_EventRevisions_Event_Rev ON dbo.[EventRevisions] ([EventRowId], [RevisionNo]);
CREATE UNIQUE INDEX UQ_EventRevisions_Event_Row ON dbo.[EventRevisions] ([EventRowId], [RowId]);
CREATE UNIQUE INDEX UQ_CouponRevisions_Coupon_Rev ON dbo.[CouponRevisions] ([CouponRowId], [RevisionNo]);
CREATE UNIQUE INDEX UQ_CouponRevisions_Coupon_Row ON dbo.[CouponRevisions] ([CouponRowId], [RowId]);
CREATE UNIQUE INDEX UQ_EventRevisions_SelectedPerEvent ON dbo.[EventRevisions] ([EventRowId]) WHERE [IsSelected] = 1;

CREATE INDEX IX_Users_Role_Status ON dbo.[Users] ([RoleRowId], [AccountStatus]);
CREATE INDEX IX_Permissions_ModuleCode ON dbo.[Permissions] ([ModuleCode]);
CREATE INDEX IX_UserSessions_User_Expires ON dbo.[UserSessions] ([UserRowId], [ExpiresAt]);
CREATE INDEX IX_PasswordResetRequests_User_Expires ON dbo.[PasswordResetRequests] ([UserRowId], [ExpiresAt]);
CREATE INDEX IX_Notifications_Recipient_ReadAt_CreatedAt ON dbo.[Notifications] ([RecipientUserRowId], [ReadAt], [CreatedAt]);
CREATE INDEX IX_Books_Status_Title ON dbo.[Books] ([Status], [Title]);
CREATE INDEX IX_Authors_FullName ON dbo.[Authors] ([FullName]);
CREATE INDEX IX_Publishers_PublisherName ON dbo.[Publishers] ([PublisherName]);
CREATE INDEX IX_Categories_Parent_Sort ON dbo.[Categories] ([ParentCategoryRowId], [SortOrder]);
CREATE INDEX IX_BookImages_Book_Sort ON dbo.[BookImages] ([BookRowId], [SortOrder]);
CREATE INDEX IX_WishlistItems_Buyer ON dbo.[WishlistItems] ([BuyerRowId]);
CREATE INDEX IX_BrowsingHistory_LastViewedAt ON dbo.[BrowsingHistory] ([LastViewedAt]);
CREATE INDEX IX_CartItems_Cart ON dbo.[CartItems] ([CartRowId]);
CREATE INDEX IX_CartItems_Recipient ON dbo.[CartItems] ([RecipientUserRowId]);
CREATE INDEX IX_Orders_Buyer_Created ON dbo.[Orders] ([BuyerRowId], [CreatedAt]);
CREATE INDEX IX_Orders_Status_PaidAt ON dbo.[Orders] ([OrderStatus], [PaidAt]);
CREATE INDEX IX_OrderItems_Order ON dbo.[OrderItems] ([OrderRowId]);
CREATE INDEX IX_OrderItems_Recipient ON dbo.[OrderItems] ([RecipientUserRowId]);
CREATE INDEX IX_OrderItems_Book_Bundle ON dbo.[OrderItems] ([BookRowId], [BundleRowId]);
CREATE INDEX IX_OrderItemBooks_Book ON dbo.[OrderItemBooks] ([BookRowId]);
CREATE INDEX IX_PaymentAttempts_Order_Status ON dbo.[PaymentAttempts] ([OrderRowId], [Status]);
CREATE INDEX IX_PaymentGatewayEvents_Attempt ON dbo.[PaymentGatewayEvents] ([PaymentAttemptRowId]);
CREATE INDEX IX_OrderStatusHistory_Order_ChangedAt ON dbo.[OrderStatusHistory] ([OrderRowId], [ChangedAt]);
CREATE INDEX IX_DigitalEntitlements_User ON dbo.[DigitalEntitlements] ([UserRowId]);
CREATE INDEX IX_EntitlementSources_Entitlement ON dbo.[EntitlementSources] ([EntitlementRowId]);
CREATE INDEX IX_BookAccessLogs_User_Book_Time ON dbo.[BookAccessLogs] ([UserRowId], [BookRowId], [OccurredAt]);
CREATE INDEX IX_BookAccessLogs_RequestId ON dbo.[BookAccessLogs] ([RequestId]);
CREATE INDEX IX_BundleBooks_Bundle_Sort ON dbo.[BundleBooks] ([BundleRevisionRowId], [SortOrder]);
CREATE INDEX IX_EventBooks_Event_Featured ON dbo.[EventBooks] ([EventRevisionRowId], [IsFeatured]);
CREATE INDEX IX_EventBundles_Event_Featured ON dbo.[EventBundles] ([EventRevisionRowId], [IsFeatured]);
CREATE INDEX IX_CouponUsages_Coupon_Status ON dbo.[CouponUsages] ([CouponRowId], [UsageStatus]);
CREATE INDEX IX_CouponUsages_Buyer_Status ON dbo.[CouponUsages] ([BuyerRowId], [UsageStatus]);
CREATE INDEX IX_Reviews_Book_Status_Created ON dbo.[Reviews] ([BookRowId], [ReviewStatus], [CreatedAt]);
CREATE INDEX IX_ContentReports_Status_Created ON dbo.[ContentReports] ([ReportStatus], [CreatedAt]);
CREATE INDEX IX_ContentReports_Target ON dbo.[ContentReports] ([TargetType], [TargetRowId]);
CREATE INDEX IX_Complaints_Status_Assigned_Created ON dbo.[Complaints] ([ComplaintStatus], [AssignedTo], [CreatedAt]);
CREATE INDEX IX_ComplaintMessages_Complaint_SentAt ON dbo.[ComplaintMessages] ([ComplaintRowId], [SentAt]);
CREATE INDEX IX_AIConversations_Owner_Type_Time ON dbo.[AIConversations] ([OwnerUserRowId], [AssistantType], [LastMessageAt]);
CREATE INDEX IX_AIMessages_Conversation_SentAt ON dbo.[AIMessages] ([ConversationRowId], [SentAt]);
CREATE INDEX IX_AIActionLogs_User_Request ON dbo.[AIActionLogs] ([InitiatorUserRowId], [RequestId]);
CREATE INDEX IX_AIActionLogs_Conversation ON dbo.[AIActionLogs] ([ConversationRowId]);
CREATE INDEX IX_AIActionLogs_RequestId ON dbo.[AIActionLogs] ([RequestId]);
CREATE INDEX IX_KnowledgeArticles_Status_Role ON dbo.[KnowledgeArticles] ([ArticleStatus], [AudienceRole]);
CREATE INDEX IX_AuditLogs_Table_Record_Occurred ON dbo.[AuditLogs] ([TableName], [RecordRowId], [OccurredAt]);
CREATE INDEX IX_AuditLogs_Actor_Occurred ON dbo.[AuditLogs] ([ActorUserRowId], [OccurredAt]);
CREATE INDEX IX_AuditLogs_RequestId ON dbo.[AuditLogs] ([RequestId]);
CREATE INDEX IX_AuditLogs_ActionCode ON dbo.[AuditLogs] ([ActionCode]);
CREATE INDEX IX_SystemLogs_Level_Occurred ON dbo.[SystemLogs] ([LogLevel], [OccurredAt]);
CREATE INDEX IX_SystemLogs_RequestId ON dbo.[SystemLogs] ([RequestId]);
CREATE INDEX IX_EventRevisions_Schedule ON dbo.[EventRevisions] ([IsSelected], [StartAt], [EndAt]);
CREATE INDEX IX_CouponRevisions_Schedule ON dbo.[CouponRevisions] ([ApprovalStatus], [StartAt], [EndAt]);
CREATE INDEX IX_AIActionRequests_Initiator_Status ON dbo.[AIActionRequests] ([InitiatorUserRowId], [RequestStatus]);
CREATE INDEX IX_AIActionRequests_RequestId ON dbo.[AIActionRequests] ([RequestId]);
CREATE INDEX IX_OutboxMessages_Status_Available ON dbo.[OutboxMessages] ([DeliveryStatus], [AvailableAt]);
CREATE INDEX IX_PaymentCallbackReceipts_PresentedEventId ON dbo.[PaymentCallbackReceipts] ([PresentedEventId]);
CREATE INDEX IX_PaymentCallbackReceipts_GatewayEvent ON dbo.[PaymentCallbackReceipts] ([GatewayEventRowId]);
GO

-- ====================== (D) RÀNG BUỘC CHECK ======================

ALTER TABLE dbo.[Roles] ADD CONSTRAINT CK_Roles_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Permissions] ADD CONSTRAINT CK_Permissions_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Users] ADD CONSTRAINT CK_Users_AccountStatus CHECK ([AccountStatus] IN ('ACTIVE', 'DISABLED'));
ALTER TABLE dbo.[Users] ADD CONSTRAINT CK_Users_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Users] ADD CONSTRAINT CK_Users_Disabled CHECK (([AccountStatus] = 'ACTIVE') OR ([AccountStatus] = 'DISABLED' AND [DisabledAt] IS NOT NULL AND [DisableReason] IS NOT NULL));
ALTER TABLE dbo.[Users] ADD CONSTRAINT CK_Users_NoSelfDisable CHECK ([DisabledBy] IS NULL OR [DisabledBy] <> [RowId]);
ALTER TABLE dbo.[Books] ADD CONSTRAINT CK_Books_PageCount CHECK ([PageCount] > 0);
ALTER TABLE dbo.[Books] ADD CONSTRAINT CK_Books_OriginalPrice CHECK ([OriginalPrice] >= 0);
ALTER TABLE dbo.[Books] ADD CONSTRAINT CK_Books_Status CHECK ([Status] IN ('DRAFT', 'PUBLISHED', 'HIDDEN'));
ALTER TABLE dbo.[Books] ADD CONSTRAINT CK_Books_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Books] ADD CONSTRAINT CK_Books_Suspension CHECK ([ServingSuspendedAt] IS NULL OR ([SuspensionReason] IS NOT NULL AND [SuspendedBy] IS NOT NULL));
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT CK_BookFiles_MimeType CHECK ([MimeType] = 'application/pdf');
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT CK_BookFiles_FileSizeBytes CHECK ([FileSizeBytes] > 0);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT CK_BookFiles_FileVersion CHECK ([FileVersion] >= 1);
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT CK_BookFiles_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BookFiles] ADD CONSTRAINT CK_BookFiles_Current_NotDeleted CHECK ([IsCurrent] = 0 OR [IsDel] = 0);
ALTER TABLE dbo.[Authors] ADD CONSTRAINT CK_Authors_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Publishers] ADD CONSTRAINT CK_Publishers_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Categories] ADD CONSTRAINT CK_Categories_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BookAuthors] ADD CONSTRAINT CK_BookAuthors_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BookCategories] ADD CONSTRAINT CK_BookCategories_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BookImages] ADD CONSTRAINT CK_BookImages_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[WishlistItems] ADD CONSTRAINT CK_WishlistItems_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BrowsingHistory] ADD CONSTRAINT CK_BrowsingHistory_ViewCount CHECK ([ViewCount] > 0);
ALTER TABLE dbo.[Carts] ADD CONSTRAINT CK_Carts_CartStatus CHECK ([CartStatus] IN ('ACTIVE', 'CHECKED_OUT'));
ALTER TABLE dbo.[Carts] ADD CONSTRAINT CK_Carts_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT CK_CartItems_ProductType CHECK ([ProductType] IN ('BOOK', 'BUNDLE'));
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT CK_CartItems_Quantity CHECK ([Quantity] = 1);
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT CK_CartItems_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[CartItems] ADD CONSTRAINT CK_CartItems_ProductXor CHECK (([ProductType] = 'BOOK' AND [BookRowId] IS NOT NULL AND [BundleRowId] IS NULL) OR ([ProductType] = 'BUNDLE' AND [BundleRowId] IS NOT NULL AND [BookRowId] IS NULL));
ALTER TABLE dbo.[CartItemBooks] ADD CONSTRAINT CK_CartItemBooks_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_OrderStatus CHECK ([OrderStatus] IN ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'));
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_BooksOriginalSubtotal CHECK ([BooksOriginalSubtotal] >= 0);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_BundleSubtotal CHECK ([BundleSubtotal] >= 0);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_DiscountSource CHECK ([DiscountSource] IN ('NONE', 'EVENT', 'COUPON'));
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_DiscountAmount CHECK ([DiscountAmount] >= 0);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_TotalAmount CHECK ([TotalAmount] >= 0);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_PriceSnapshotJson_Json CHECK (ISJSON([PriceSnapshotJson]) = 1);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_Total CHECK ([TotalAmount] = [BooksOriginalSubtotal] + [BundleSubtotal] - [DiscountAmount]);
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_PaidAt CHECK (([OrderStatus] = 'PAID' AND [PaidAt] IS NOT NULL) OR ([OrderStatus] <> 'PAID'));
ALTER TABLE dbo.[Orders] ADD CONSTRAINT CK_Orders_DiscountSource_Consistency CHECK (([DiscountSource] = 'NONE' AND [CouponRowId] IS NULL AND [EventRowId] IS NULL AND [DiscountAmount] = 0) OR ([DiscountSource] = 'COUPON' AND [CouponRowId] IS NOT NULL AND [EventRowId] IS NULL) OR ([DiscountSource] = 'EVENT' AND [EventRowId] IS NOT NULL AND [CouponRowId] IS NULL));
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_ProductType CHECK ([ProductType] IN ('BOOK', 'BUNDLE'));
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_OriginalUnitPrice CHECK ([OriginalUnitPrice] >= 0);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_FinalLineAmount CHECK ([FinalLineAmount] >= 0);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_LineDiscountAmount CHECK ([LineDiscountAmount] >= 0);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_DiscountSource CHECK ([DiscountSource] IN ('NONE', 'EVENT', 'COUPON'));
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_Quantity CHECK ([Quantity] = 1);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_ProductXor CHECK (([ProductType] = 'BOOK' AND [BookRowId] IS NOT NULL AND [BundleRowId] IS NULL) OR ([ProductType] = 'BUNDLE' AND [BundleRowId] IS NOT NULL AND [BookRowId] IS NULL));
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_FinalLine CHECK ([FinalLineAmount] = [OriginalUnitPrice] - [LineDiscountAmount]);
ALTER TABLE dbo.[OrderItems] ADD CONSTRAINT CK_OrderItems_BundleNoDiscount CHECK ([ProductType] <> 'BUNDLE' OR [LineDiscountAmount] = 0);
ALTER TABLE dbo.[OrderItemBooks] ADD CONSTRAINT CK_OrderItemBooks_OriginalBookPriceSnapshot CHECK ([OriginalBookPriceSnapshot] >= 0);
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT CK_PaymentAttempts_Amount CHECK ([Amount] >= 0);
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT CK_PaymentAttempts_Status CHECK ([Status] IN ('PENDING', 'SUCCEEDED', 'FAILED'));
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT CK_PaymentAttempts_PaymentType CHECK ([PaymentType] IN ('MOCK_GATEWAY', 'INTERNAL_FREE'));
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT CK_PaymentAttempts_Expires CHECK (([PaymentType] = 'MOCK_GATEWAY' AND [ExpiresAt] IS NOT NULL) OR [PaymentType] = 'INTERNAL_FREE');
ALTER TABLE dbo.[PaymentAttempts] ADD CONSTRAINT CK_PaymentAttempts_Completed CHECK (([Status] = 'PENDING' AND [CompletedAt] IS NULL) OR ([Status] <> 'PENDING' AND [CompletedAt] IS NOT NULL));
ALTER TABLE dbo.[PaymentGatewayEvents] ADD CONSTRAINT CK_PaymentGatewayEvents_GatewayStatus CHECK ([GatewayStatus] IN ('SUCCEEDED', 'FAILED'));
ALTER TABLE dbo.[PaymentGatewayEvents] ADD CONSTRAINT CK_PaymentGatewayEvents_ProcessingResult CHECK ([ProcessingResult] IN ('APPLIED', 'LATE'));
ALTER TABLE dbo.[DigitalEntitlements] ADD CONSTRAINT CK_DigitalEntitlements_EntitlementStatus CHECK ([EntitlementStatus] IN ('ACTIVE', 'SUSPENDED'));
ALTER TABLE dbo.[EntitlementSources] ADD CONSTRAINT CK_EntitlementSources_SourceType CHECK ([SourceType] IN ('PURCHASE', 'GIFT'));
ALTER TABLE dbo.[BookAccessLogs] ADD CONSTRAINT CK_BookAccessLogs_AccessType CHECK ([AccessType] IN ('READ', 'DOWNLOAD'));
ALTER TABLE dbo.[BookAccessLogs] ADD CONSTRAINT CK_BookAccessLogs_AccessResult CHECK ([AccessResult] IN ('ALLOWED', 'DENIED'));
ALTER TABLE dbo.[Bundles] ADD CONSTRAINT CK_Bundles_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BundleBooks] ADD CONSTRAINT CK_BundleBooks_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Events] ADD CONSTRAINT CK_Events_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT CK_EventBooks_SalePrice CHECK ([SalePrice] >= 0);
ALTER TABLE dbo.[EventBooks] ADD CONSTRAINT CK_EventBooks_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[EventBundles] ADD CONSTRAINT CK_EventBundles_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT CK_Coupons_GenerationMode CHECK ([GenerationMode] IN ('AUTO', 'MANUAL'));
ALTER TABLE dbo.[Coupons] ADD CONSTRAINT CK_Coupons_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT CK_CouponUsages_DiscountAmount CHECK ([DiscountAmount] >= 0);
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT CK_CouponUsages_UsageStatus CHECK ([UsageStatus] IN ('RESERVED', 'CONSUMED', 'RELEASED'));
ALTER TABLE dbo.[CouponUsages] ADD CONSTRAINT CK_CouponUsages_Consumed CHECK (([UsageStatus] <> 'CONSUMED' OR [ConsumedAt] IS NOT NULL) AND ([UsageStatus] <> 'RELEASED' OR [ReleasedAt] IS NOT NULL));
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT CK_Reviews_Rating CHECK ([Rating] BETWEEN 1 AND 5);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT CK_Reviews_ReviewStatus CHECK ([ReviewStatus] IN ('PUBLISHED', 'HIDDEN'));
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT CK_Reviews_EditCount CHECK ([EditCount] BETWEEN 0 AND 1);
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT CK_Reviews_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Reviews] ADD CONSTRAINT CK_Reviews_Hidden CHECK ([ReviewStatus] <> 'HIDDEN' OR ([HiddenBy] IS NOT NULL AND [HiddenAt] IS NOT NULL));
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT CK_ContentReports_TargetType CHECK ([TargetType] IN ('REVIEW', 'BOOK'));
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT CK_ContentReports_ReportStatus CHECK ([ReportStatus] IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'));
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT CK_ContentReports_TargetSnapshotJson_Json CHECK (ISJSON([TargetSnapshotJson]) = 1);
ALTER TABLE dbo.[ContentReports] ADD CONSTRAINT CK_ContentReports_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT CK_Complaints_Category CHECK ([Category] IN ('PAYMENT', 'ACCESS', 'CONTENT', 'ACCOUNT', 'OTHER'));
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT CK_Complaints_ComplaintStatus CHECK ([ComplaintStatus] IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'));
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT CK_Complaints_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[Complaints] ADD CONSTRAINT CK_Complaints_Resolved CHECK ([ComplaintStatus] NOT IN ('RESOLVED', 'REJECTED') OR [ResolvedAt] IS NOT NULL);
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT CK_AIConversations_AssistantType CHECK ([AssistantType] IN ('BUYER', 'ADMIN'));
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT CK_AIConversations_ConversationStatus CHECK ([ConversationStatus] IN ('ACTIVE', 'ARCHIVED'));
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT CK_AIConversations_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[AIConversations] ADD CONSTRAINT CK_AIConversations_OwnerOrGuest CHECK ([OwnerUserRowId] IS NOT NULL OR ([GuestSessionHash] IS NOT NULL AND [ExpiresAt] IS NOT NULL));
ALTER TABLE dbo.[AIMessages] ADD CONSTRAINT CK_AIMessages_MessageRole CHECK ([MessageRole] IN ('USER', 'ASSISTANT', 'TOOL'));
ALTER TABLE dbo.[AIMessages] ADD CONSTRAINT CK_AIMessages_TokenCount CHECK ([TokenCount] >= 0);
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT CK_AIActionLogs_ActionType CHECK ([ActionType] IN ('READ', 'PREVIEW', 'WRITE'));
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT CK_AIActionLogs_ConfirmationStatus CHECK ([ConfirmationStatus] IN ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'DECLINED'));
ALTER TABLE dbo.[AIActionLogs] ADD CONSTRAINT CK_AIActionLogs_ExecutionStatus CHECK ([ExecutionStatus] IN ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED'));
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT CK_KnowledgeArticles_AudienceRole CHECK ([AudienceRole] IN ('EMPLOYEE', 'MANAGER', 'ALL_ADMIN'));
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT CK_KnowledgeArticles_ArticleStatus CHECK ([ArticleStatus] IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
ALTER TABLE dbo.[KnowledgeArticles] ADD CONSTRAINT CK_KnowledgeArticles_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_ActorType CHECK ([ActorType] IN ('USER', 'SYSTEM'));
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_ActionSource CHECK ([ActionSource] IN ('WEB', 'AI', 'SYSTEM', 'API'));
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_OldValuesJson_Json CHECK (ISJSON([OldValuesJson]) = 1);
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_NewValuesJson_Json CHECK (ISJSON([NewValuesJson]) = 1);
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_ChangedFieldsJson_Json CHECK (ISJSON([ChangedFieldsJson]) = 1);
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_Result CHECK ([Result] IN ('SUCCESS', 'FAILURE'));
ALTER TABLE dbo.[AuditLogs] ADD CONSTRAINT CK_AuditLogs_TableRecord CHECK ([TableName] IS NOT NULL OR [RecordRowId] IS NULL);
ALTER TABLE dbo.[SystemLogs] ADD CONSTRAINT CK_SystemLogs_LogLevel CHECK ([LogLevel] IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'));
ALTER TABLE dbo.[SystemSettings] ADD CONSTRAINT CK_SystemSettings_SettingValueJson_Json CHECK (ISJSON([SettingValueJson]) = 1);
ALTER TABLE dbo.[SystemSettings] ADD CONSTRAINT CK_SystemSettings_SoftDelete CHECK (([IsDel] = 0 AND [DeletedAt] IS NULL) OR ([IsDel] = 1 AND [DeletedAt] IS NOT NULL));
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_RevisionNo CHECK ([RevisionNo] > 0);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_BundleType CHECK ([BundleType] IN ('FIXED', 'FLEXIBLE'));
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_RequiredSelectionCount CHECK ([RequiredSelectionCount] >= 1);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_BundlePrice CHECK ([BundlePrice] >= 0);
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_ApprovalStatus CHECK ([ApprovalStatus] IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE dbo.[BundleRevisions] ADD CONSTRAINT CK_BundleRevisions_Approved CHECK ([ApprovalStatus] <> 'APPROVED' OR ([ApprovedBy] IS NOT NULL AND [ApprovedAt] IS NOT NULL));
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_RevisionNo CHECK ([RevisionNo] > 0);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_EventType CHECK ([EventType] IN ('BOOK_SALE', 'TET_SALE'));
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_ThemePresetCode CHECK ([ThemePresetCode] IN ('BOOK_SALE', 'TET_SALE'));
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_ThemeConfigJson_Json CHECK (ISJSON([ThemeConfigJson]) = 1);
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_ApprovalStatus CHECK ([ApprovalStatus] IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'));
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_Approved CHECK ([ApprovalStatus] NOT IN ('APPROVED') OR ([ApprovedBy] IS NOT NULL AND [ApprovedAt] IS NOT NULL));
ALTER TABLE dbo.[EventRevisions] ADD CONSTRAINT CK_EventRevisions_Range CHECK ([EndAt] > [StartAt]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_RevisionNo CHECK ([RevisionNo] > 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_DiscountType CHECK ([DiscountType] IN ('PERCENT', 'FIXED'));
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_DiscountValue CHECK ([DiscountValue] > 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_MaxDiscountAmount CHECK ([MaxDiscountAmount] >= 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_MinimumBooksSubtotal CHECK ([MinimumBooksSubtotal] >= 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_UsageLimitTotal CHECK ([UsageLimitTotal] > 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_UsageLimitPerBuyer CHECK ([UsageLimitPerBuyer] > 0);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_ApprovalStatus CHECK ([ApprovalStatus] IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'));
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_Approved CHECK ([ApprovalStatus] NOT IN ('APPROVED') OR ([ApprovedBy] IS NOT NULL AND [ApprovedAt] IS NOT NULL));
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_Range CHECK ([EndAt] > [StartAt]);
ALTER TABLE dbo.[CouponRevisions] ADD CONSTRAINT CK_CouponRevisions_Percent CHECK ([DiscountType] <> 'PERCENT' OR [DiscountValue] <= 100);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT CK_AIActionRequests_PayloadJson_Json CHECK (ISJSON([PayloadJson]) = 1);
ALTER TABLE dbo.[AIActionRequests] ADD CONSTRAINT CK_AIActionRequests_RequestStatus CHECK ([RequestStatus] IN ('PENDING', 'EXECUTED', 'DECLINED', 'EXPIRED', 'INVALIDATED'));
ALTER TABLE dbo.[OutboxMessages] ADD CONSTRAINT CK_OutboxMessages_PayloadJson_Json CHECK (ISJSON([PayloadJson]) = 1);
ALTER TABLE dbo.[OutboxMessages] ADD CONSTRAINT CK_OutboxMessages_DeliveryStatus CHECK ([DeliveryStatus] IN ('PENDING', 'PROCESSING', 'SENT'));
ALTER TABLE dbo.[OutboxMessages] ADD CONSTRAINT CK_OutboxMessages_RetryCount CHECK ([RetryCount] >= 0);
ALTER TABLE dbo.[PaymentCallbackReceipts] ADD CONSTRAINT CK_PaymentCallbackReceipts_Disposition CHECK ([Disposition] IN ('APPLIED', 'DUPLICATE', 'INVALID', 'LATE', 'ERROR'));
GO

-- ====================== (E) DỮ LIỆU THAM CHIẾU TỐI THIỂU ======================
INSERT INTO dbo.[Roles] ([RoleCode], [RoleName], [Description], [IsSystem]) VALUES
 ('BUYER',    N'Người mua',  N'Mua, đọc, tải, tặng sách PDF',            1),
 ('EMPLOYEE', N'Nhân viên',  N'Quản lý sách, hỗ trợ, kiểm duyệt nội dung', 1),
 ('MANAGER',  N'Quản lý',    N'Phê duyệt Bundle/Event/Coupon, báo cáo, nhân sự', 1);
GO
PRINT N'Hoàn tất tạo schema Nhà sách PDF.';
