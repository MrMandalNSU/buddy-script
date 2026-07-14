export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "BuddyScript API",
    version: "0.1.0",
    description: "Versioned REST API for BuddyScript.",
  },
  servers: [{ url: "/api/v1", description: "Current origin" }],
  tags: [
    { name: "Health", description: "Container health and readiness" },
    { name: "Authentication", description: "Cookie-based JWT authentication" },
    { name: "Posts", description: "Protected feed and post reactions" },
    { name: "Comments", description: "Protected comments, replies, and reactions" },
    { name: "Uploads", description: "Signed direct-to-Cloudinary uploads" },
  ],
  paths: {
    "/health/live": {
      get: {
        tags: ["Health"], summary: "Liveness probe", operationId: "getLiveness",
        responses: { "200": { description: "The process is alive" } },
      },
    },
    "/health/ready": {
      get: {
        tags: ["Health"], summary: "Readiness probe", operationId: "getReadiness",
        responses: {
          "200": { description: "The service can accept traffic" },
          "503": { description: "The service is not ready" },
        },
      },
    },
    "/auth/register": { post: { tags: ["Authentication"], summary: "Create an account", operationId: "register", requestBody: { required: true }, responses: { "201": { description: "Account created" }, "409": { description: "Email already exists" }, "422": { description: "Validation failed" } } } },
    "/auth/login": { post: { tags: ["Authentication"], summary: "Start a session", operationId: "login", requestBody: { required: true }, responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid credentials" } } } },
    "/auth/refresh": { post: { tags: ["Authentication"], summary: "Rotate a refresh token", operationId: "refreshSession", security: [{ refreshCookie: [], csrfHeader: [] }], responses: { "200": { description: "Session rotated" }, "401": { description: "Session invalid or reused" }, "403": { description: "CSRF validation failed" } } } },
    "/auth/logout": { post: { tags: ["Authentication"], summary: "Revoke the current refresh session", operationId: "logout", security: [{ refreshCookie: [], csrfHeader: [] }], responses: { "204": { description: "Logged out" } } } },
    "/auth/logout-all": { post: { tags: ["Authentication"], summary: "Revoke every session for the current user", operationId: "logoutAll", security: [{ accessCookie: [], csrfHeader: [] }], responses: { "204": { description: "All sessions revoked" } } } },
    "/auth/me": { get: { tags: ["Authentication"], summary: "Get the authenticated user", operationId: "getCurrentUser", security: [{ accessCookie: [] }], responses: { "200": { description: "Current user" }, "401": { description: "Authentication required" } } } },
    "/posts": {
      get: { tags: ["Posts"], summary: "Get the newest visible posts", operationId: "listPosts", security: [{ accessCookie: [] }], parameters: [{ name: "cursor", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } }], responses: { "200": { description: "Keyset-paginated posts" }, "400": { description: "Invalid cursor" } } },
      post: { tags: ["Posts"], summary: "Create a text or image post", description: "Cloudinary metadata must have a valid server-verifiable signature.", operationId: "createPost", security: [{ accessCookie: [], csrfHeader: [] }], requestBody: { required: true }, responses: { "201": { description: "Post created" }, "422": { description: "Validation or image verification failed" } } },
    },
    "/posts/{postId}": {
      patch: { tags: ["Posts"], summary: "Edit an authored post", description: "Updates text, audience, or verified image metadata. Null body/image removes that content while preserving the text-or-image invariant.", operationId: "updatePost", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], requestBody: { required: true }, responses: { "200": { description: "Updated canonical post" }, "403": { description: "Only the post author may edit a visible post" }, "404": { description: "Post missing or private" }, "422": { description: "Validation, content invariant, or image verification failed" } } },
      delete: { tags: ["Posts"], summary: "Delete an authored post", description: "Permanently deletes the post and cascades to comments, replies, and reactions.", operationId: "deletePost", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "204": { description: "Post deleted" }, "403": { description: "Only the post author may delete a visible post" }, "404": { description: "Post missing or private" } } },
    },
    "/posts/{postId}/like": {
      post: { tags: ["Posts"], summary: "Like a visible post", operationId: "likePost", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Current reaction state" }, "404": { description: "Post not visible" } } },
      delete: { tags: ["Posts"], summary: "Unlike a visible post", operationId: "unlikePost", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Current reaction state" }, "404": { description: "Post not visible" } } },
    },
    "/posts/{postId}/likers": { get: { tags: ["Posts"], summary: "List users who liked a visible post", operationId: "listPostLikers", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Keyset-paginated liker identities" }, "404": { description: "Post not visible" } } } },
    "/posts/{postId}/reaction": {
      put: { tags: ["Posts"], summary: "Add or change a typed post reaction", operationId: "setPostReaction", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], requestBody: { required: true }, responses: { "200": { description: "Typed reaction state and real account preview" }, "404": { description: "Post not visible" } } },
      delete: { tags: ["Posts"], summary: "Remove the viewer's post reaction", operationId: "removePostReaction", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Typed reaction state" }, "404": { description: "Post not visible" } } },
    },
    "/posts/{postId}/reactors": { get: { tags: ["Posts"], summary: "List real accounts that reacted to a visible post", operationId: "listPostReactors", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Keyset-paginated reactor identities and reaction types" }, "404": { description: "Post not visible" } } } },
    "/posts/{postId}/comments": {
      get: { tags: ["Comments"], summary: "List root comments for a visible post", operationId: "listComments", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "Keyset-paginated comments" }, "404": { description: "Post not visible" } } },
      post: { tags: ["Comments"], summary: "Add a root comment", operationId: "createComment", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/PostId" }], requestBody: { required: true }, responses: { "201": { description: "Comment created" }, "404": { description: "Post not visible" } } },
    },
    "/comments/{commentId}/replies": {
      get: { tags: ["Comments"], summary: "List direct replies", operationId: "listReplies", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Keyset-paginated replies" }, "404": { description: "Comment not visible" } } },
      post: { tags: ["Comments"], summary: "Add a direct reply", operationId: "createReply", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], requestBody: { required: true }, responses: { "201": { description: "Reply created" }, "404": { description: "Comment not visible" } } },
    },
    "/comments/{commentId}": {
      patch: { tags: ["Comments"], summary: "Edit an authored comment or reply", operationId: "updateComment", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], requestBody: { required: true }, responses: { "200": { description: "Updated canonical comment" }, "403": { description: "Only the comment author may edit" }, "404": { description: "Comment not visible" } } },
      delete: { tags: ["Comments"], summary: "Delete an authorized comment or reply", description: "Comment authors and the owning post author may delete. Root deletion cascades to replies.", operationId: "deleteComment", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "204": { description: "Comment deleted" }, "403": { description: "Deletion is not permitted" }, "404": { description: "Comment not visible" } } },
    },
    "/comments/{commentId}/like": {
      post: { tags: ["Comments"], summary: "Like a visible comment or reply", operationId: "likeComment", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Current reaction state" }, "404": { description: "Comment not visible" } } },
      delete: { tags: ["Comments"], summary: "Unlike a visible comment or reply", operationId: "unlikeComment", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Current reaction state" }, "404": { description: "Comment not visible" } } },
    },
    "/comments/{commentId}/likers": { get: { tags: ["Comments"], summary: "List users who liked a visible comment or reply", operationId: "listCommentLikers", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Keyset-paginated liker identities" }, "404": { description: "Comment not visible" } } } },
    "/comments/{commentId}/reaction": {
      put: { tags: ["Comments"], summary: "Add or change a typed comment reaction", operationId: "setCommentReaction", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], requestBody: { required: true }, responses: { "200": { description: "Typed reaction state" }, "404": { description: "Comment not visible" } } },
      delete: { tags: ["Comments"], summary: "Remove the viewer's comment reaction", operationId: "removeCommentReaction", security: [{ accessCookie: [], csrfHeader: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Typed reaction state" }, "404": { description: "Comment not visible" } } },
    },
    "/comments/{commentId}/reactors": { get: { tags: ["Comments"], summary: "List real accounts that reacted to a visible comment", operationId: "listCommentReactors", security: [{ accessCookie: [] }], parameters: [{ $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "Keyset-paginated reactor identities and reaction types" }, "404": { description: "Comment not visible" } } } },
    "/uploads/signature": { post: { tags: ["Uploads"], summary: "Create a short-lived authenticated upload signature", operationId: "createUploadSignature", security: [{ accessCookie: [], csrfHeader: [] }], responses: { "200": { description: "Cloudinary upload parameters" }, "503": { description: "Uploads are not configured" } } } },
  },
  components: {
    securitySchemes: {
      accessCookie: { type: "apiKey", in: "cookie", name: "__Host-bs_access", description: "Secure production access JWT cookie" },
      refreshCookie: { type: "apiKey", in: "cookie", name: "__Secure-bs_refresh", description: "Secure production refresh JWT cookie" },
      csrfHeader: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
    },
    parameters: {
      PostId: { name: "postId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      CommentId: { name: "commentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
    },
    schemas: {
      Error: {
        type: "object", required: ["success", "error", "meta"],
        properties: {
          success: { const: false },
          error: {
            type: "object", required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "object" } },
          },
          meta: { $ref: "#/components/schemas/Meta" },
        },
      },
      Meta: {
        type: "object", required: ["requestId", "timestamp"],
        properties: { requestId: { type: "string" }, timestamp: { type: "string", format: "date-time" } },
      },
    },
  },
} as const;
