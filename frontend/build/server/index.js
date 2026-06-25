import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, UNSAFE_withErrorBoundaryProps, isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { jsx, jsxs } from "react/jsx-runtime";
import { Suspense, lazy } from "react";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region node_modules/@react-router/dev/dist/config/defaults/entry.server.node.tsx
var entry_server_node_exports = /* @__PURE__ */ __exportAll({
	default: () => handleRequest,
	streamTimeout: () => streamTimeout
});
var streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
	if (request.method.toUpperCase() === "HEAD") return new Response(null, {
		status: responseStatusCode,
		headers: responseHeaders
	});
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		let userAgent = request.headers.get("user-agent");
		let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
		let timeoutId = setTimeout(() => abort(), 6e3);
		const { pipe, abort } = renderToPipeableStream(/* @__PURE__ */ jsx(ServerRouter, {
			context: routerContext,
			url: request.url
		}), {
			[readyOption]() {
				shellRendered = true;
				const body = new PassThrough({ final(callback) {
					clearTimeout(timeoutId);
					timeoutId = void 0;
					callback();
				} });
				const stream = createReadableStreamFromReadable(body);
				responseHeaders.set("Content-Type", "text/html");
				pipe(body);
				resolve(new Response(stream, {
					headers: responseHeaders,
					status: responseStatusCode
				}));
			},
			onShellError(error) {
				reject(error);
			},
			onError(error) {
				responseStatusCode = 500;
				if (shellRendered) console.error(error);
			}
		});
	});
}
//#endregion
//#region src/root.jsx
/**
* root.jsx — React Router Framework Mode application shell.
*
* This file is evaluated in BOTH Node (during build prerender) and the browser.
* Therefore we MUST NOT import MUI directly — MUI accesses document/window at
* module-evaluation time and crashes Node.
*
* Pattern: React.lazy + Suspense for the MUI subtree ensures MUI is only
* ever evaluated in the browser.
*
* Exports:
*   Layout        — HTML document shell (safe in Node — no MUI)
*   default       — App root (lazy-loads MUI client wrapper)
*   ErrorBoundary — Top-level route error handler
*/
var root_exports = /* @__PURE__ */ __exportAll({
	ErrorBoundary: () => ErrorBoundary,
	Layout: () => Layout,
	default: () => root_default
});
var ClientApp = lazy(() => import("./assets/ClientApp-dn7a4XKk.js"));
function AppLoader() {
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			height: "100vh",
			fontFamily: "\"Inter\", sans-serif",
			background: "#f5f6fa",
			color: "#1E3A8A",
			fontSize: 14
		},
		children: "Loading…"
	});
}
function Layout({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsxs("head", { children: [
			/* @__PURE__ */ jsx("meta", { charSet: "UTF-8" }),
			/* @__PURE__ */ jsx("meta", {
				name: "viewport",
				content: "width=device-width, initial-scale=1.0"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			}),
			/* @__PURE__ */ jsx("link", {
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
				rel: "stylesheet"
			}),
			/* @__PURE__ */ jsx("link", {
				rel: "icon",
				href: "data:,"
			}),
			/* @__PURE__ */ jsx(Meta, {}),
			/* @__PURE__ */ jsx(Links, {})
		] }), /* @__PURE__ */ jsxs("body", { children: [
			children,
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
var root_default = UNSAFE_withComponentProps(function Root() {
	return /* @__PURE__ */ jsx(Suspense, {
		fallback: /* @__PURE__ */ jsx(AppLoader, {}),
		children: /* @__PURE__ */ jsx(ClientApp, { children: /* @__PURE__ */ jsx(Outlet, {}) })
	});
});
var ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary() {
	const error = useRouteError();
	const navigate = useNavigate();
	let statusText = "";
	let errorMessage = "An unexpected error occurred.";
	if (isRouteErrorResponse(error)) {
		statusText = `${error.status} ${error.statusText}`;
		errorMessage = error.data?.message || error.statusText || errorMessage;
	} else if (error instanceof Error) errorMessage = error.message;
	else if (typeof error === "string") errorMessage = error;
	console.error("[Route Error Boundary]", error);
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			minHeight: "80vh",
			padding: 24,
			background: "#f5f6fa",
			fontFamily: "\"Inter\", sans-serif"
		},
		children: /* @__PURE__ */ jsxs("div", {
			style: {
				padding: 40,
				maxWidth: 500,
				width: "100%",
				textAlign: "center",
				background: "#fff",
				borderRadius: 12,
				boxShadow: "0 8px 24px rgba(0,0,0,0.05)"
			},
			children: [
				/* @__PURE__ */ jsx("div", {
					style: {
						fontSize: 64,
						marginBottom: 16
					},
					children: "⚠️"
				}),
				/* @__PURE__ */ jsx("h1", {
					style: {
						fontWeight: 700,
						color: "#1E3A8A",
						margin: "0 0 8px"
					},
					children: "Oops!"
				}),
				statusText && /* @__PURE__ */ jsx("p", {
					style: {
						fontWeight: 600,
						color: "#666",
						margin: "0 0 8px"
					},
					children: statusText
				}),
				/* @__PURE__ */ jsx("p", {
					style: {
						color: "#666",
						margin: "0 0 32px"
					},
					children: errorMessage
				}),
				/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						gap: 12,
						justifyContent: "center"
					},
					children: [/* @__PURE__ */ jsx("button", {
						onClick: () => navigate(-1),
						style: {
							padding: "10px 20px",
							borderRadius: 8,
							background: "#1E3A8A",
							color: "#fff",
							border: "none",
							fontWeight: 600,
							cursor: "pointer"
						},
						children: "Go Back"
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => navigate("/dashboard"),
						style: {
							padding: "10px 20px",
							borderRadius: 8,
							background: "transparent",
							color: "#1E3A8A",
							border: "1.5px solid #1E3A8A",
							fontWeight: 600,
							cursor: "pointer"
						},
						children: "Go to Dashboard"
					})]
				})
			]
		})
	});
});
//#endregion
//#region \0virtual:react-router/server-manifest
var server_manifest_default = {
	"entry": {
		"module": "/assets/entry.client-BYs7YFW2.js",
		"imports": [
			"/assets/react-B8IZ02wI.js",
			"/assets/errorBoundaries-pBExVDlO.js",
			"/assets/react-dom-0ZK-Lw7i.js",
			"/assets/components-COO5XB0-.js",
			"/assets/hooks-WhnFmKJG.js",
			"/assets/jsx-runtime-fBfwind-.js"
		],
		"css": []
	},
	"routes": {
		"root": {
			"id": "root",
			"parentId": void 0,
			"path": "",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": true,
			"module": "/assets/root-DFkxgaRh.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/errorBoundaries-pBExVDlO.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/components-COO5XB0-.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/lib-BNka6H7p.js"
			],
			"css": ["/assets/root-CSY25xYC.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/home": {
			"id": "routes/home",
			"parentId": "root",
			"path": void 0,
			"index": true,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/home-Cx59GJLo.js",
			"imports": [
				"/assets/components-COO5XB0-.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/react-B8IZ02wI.js",
				"/assets/hooks-WhnFmKJG.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/public-layout": {
			"id": "routes/public-layout",
			"parentId": "root",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/public-layout-D_jF64Pv.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/components-COO5XB0-.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/hooks-WhnFmKJG.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/login": {
			"id": "routes/login",
			"parentId": "routes/public-layout",
			"path": "/login",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/login-DrC5zgwt.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/LockOutlined-YhylQknH.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Divider-DnIxXSHB.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/ssoService-DXYwgsqS.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/sso-callback": {
			"id": "routes/sso-callback",
			"parentId": "routes/public-layout",
			"path": "/auth/sso/callback",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/sso-callback-BnjKmmYQ.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/lib-BNka6H7p.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/ssoService-DXYwgsqS.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/errorBoundaries-pBExVDlO.js",
				"/assets/components-COO5XB0-.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/protected-layout": {
			"id": "routes/protected-layout",
			"parentId": "root",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/protected-layout-AhUlgL6a.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/ChevronRight-CTfvfcDh.js",
				"/assets/LibraryBooks-Dm564AS3.js",
				"/assets/Avatar-D8OTzJ1E.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/Divider-DnIxXSHB.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/ListItemIcon-mclE9o5c.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/components-COO5XB0-.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/ProtectedRoute-hEj19LjY.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/AuthProvider-CEflV1pw.js",
				"/assets/axiosInstance-vP7tWF1p.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/dashboard": {
			"id": "routes/dashboard",
			"parentId": "routes/protected-layout",
			"path": "/dashboard",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/dashboard-B5pKAIUw.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/Add-zaaWYJm0.js",
				"/assets/useCycles-CHxOWxLE.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/DeleteOutlined-CV_Q-ZFz.js",
				"/assets/Edit-BY2Sr4MF.js",
				"/assets/RateReview-BvqnqNkl.js",
				"/assets/Search-DjMUdiZP.js",
				"/assets/WarningAmber-BmUWJ2aX.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/ListItemIcon-mclE9o5c.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/Stepper-Cg0dHJSO.js",
				"/assets/TableRow-CzK0MWOW.js",
				"/assets/TableSortLabel-Caa_pfhc.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/cyclesApi-BiQvHHY_.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/cycle-detail": {
			"id": "routes/cycle-detail",
			"parentId": "routes/protected-layout",
			"path": "/cycles/:id",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/cycle-detail-pDr4uJiA.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/ArrowBack-NPk06vje.js",
				"/assets/useCycles-CHxOWxLE.js",
				"/assets/CalendarMonth-85ePLrPJ.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/ChevronRight-CTfvfcDh.js",
				"/assets/Close-DaGrTFw_.js",
				"/assets/DeleteOutlined-CV_Q-ZFz.js",
				"/assets/Edit-BY2Sr4MF.js",
				"/assets/RateReview-BvqnqNkl.js",
				"/assets/Save-H0FKjele.js",
				"/assets/WarningAmber-BmUWJ2aX.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/ListItemIcon-mclE9o5c.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/Stepper-Cg0dHJSO.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/lib-BNka6H7p.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/cyclesApi-BiQvHHY_.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/errorBoundaries-pBExVDlO.js",
				"/assets/components-COO5XB0-.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/self-assessment": {
			"id": "routes/self-assessment",
			"parentId": "routes/protected-layout",
			"path": "/assessments/self",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/self-assessment-eM1ICtm6.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/CalendarMonth-85ePLrPJ.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/ChevronRight-CTfvfcDh.js",
				"/assets/Close-DaGrTFw_.js",
				"/assets/ExpandLess-B_LcGZWZ.js",
				"/assets/LockOutlined-YhylQknH.js",
				"/assets/Save-H0FKjele.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/Avatar-D8OTzJ1E.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Collapse-C2MPiqjw.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/Divider-DnIxXSHB.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/LinearProgress-BGahG-iF.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/Stepper-Cg0dHJSO.js",
				"/assets/TableRow-CzK0MWOW.js",
				"/assets/lib-BNka6H7p.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/stageUtils-CCAPjU_E.js",
				"/assets/cyclesApi-BiQvHHY_.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/errorBoundaries-pBExVDlO.js",
				"/assets/components-COO5XB0-.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/role-layout": {
			"id": "routes/role-layout",
			"parentId": "routes/protected-layout",
			"path": void 0,
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/role-layout-DdZbqz4M.js",
			"imports": [
				"/assets/components-COO5XB0-.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/ProtectedRoute-hEj19LjY.js",
				"/assets/react-B8IZ02wI.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/AuthProvider-CEflV1pw.js",
				"/assets/axiosInstance-vP7tWF1p.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/cycles-list": {
			"id": "routes/cycles-list",
			"parentId": "routes/role-layout",
			"path": "/cycles",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/cycles-list-n6rVcntt.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/routes-Bfwn16YJ.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/kra-library": {
			"id": "routes/kra-library",
			"parentId": "routes/role-layout",
			"path": "/kra-library",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/kra-library-DRKJj-K3.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/Add-zaaWYJm0.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/Close-DaGrTFw_.js",
				"/assets/DeleteOutlined-CV_Q-ZFz.js",
				"/assets/Edit-BY2Sr4MF.js",
				"/assets/ExpandLess-B_LcGZWZ.js",
				"/assets/LibraryBooks-Dm564AS3.js",
				"/assets/Search-DjMUdiZP.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Checkbox-CeLK1xlk.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/kraLibraryApi-D24o_obq.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/bulk-assignment": {
			"id": "routes/bulk-assignment",
			"parentId": "routes/role-layout",
			"path": "/assignments",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/bulk-assignment-DpK5-Q30.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/Close-DaGrTFw_.js",
				"/assets/DeleteOutlined-CV_Q-ZFz.js",
				"/assets/ExpandLess-B_LcGZWZ.js",
				"/assets/Visibility-WtiMoS66.js",
				"/assets/Save-H0FKjele.js",
				"/assets/Search-DjMUdiZP.js",
				"/assets/WarningAmber-BmUWJ2aX.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/Avatar-D8OTzJ1E.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Checkbox-CeLK1xlk.js",
				"/assets/Collapse-C2MPiqjw.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/LinearProgress-BGahG-iF.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/TableSortLabel-Caa_pfhc.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/lib-BNka6H7p.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/kraLibraryApi-D24o_obq.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/errorBoundaries-pBExVDlO.js",
				"/assets/components-COO5XB0-.js",
				"/assets/hooks-WhnFmKJG.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/team-performance": {
			"id": "routes/team-performance",
			"parentId": "routes/role-layout",
			"path": "/assessments/team",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/team-performance-BZVjmtI7.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/ArrowBack-NPk06vje.js",
				"/assets/CalendarMonth-85ePLrPJ.js",
				"/assets/CheckCircle-BYXSVZ9A.js",
				"/assets/ChevronRight-CTfvfcDh.js",
				"/assets/Close-DaGrTFw_.js",
				"/assets/Visibility-WtiMoS66.js",
				"/assets/LockOutlined-YhylQknH.js",
				"/assets/RateReview-BvqnqNkl.js",
				"/assets/Save-H0FKjele.js",
				"/assets/Search-DjMUdiZP.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/Avatar-D8OTzJ1E.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Button-CAOaiqsn.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Divider-DnIxXSHB.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/LinearProgress-BGahG-iF.js",
				"/assets/Tooltip-oSIKCCAV.js",
				"/assets/TableRow-CzK0MWOW.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/stageUtils-CCAPjU_E.js",
				"/assets/cyclesApi-BiQvHHY_.js",
				"/assets/useRoleAccess-BQH_FNpz.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/useAuth-COfnfh29.js",
				"/assets/AuthProvider-CEflV1pw.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/reports": {
			"id": "routes/reports",
			"parentId": "routes/role-layout",
			"path": "/reports",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/reports-D1URXQIV.js",
			"imports": [
				"/assets/react-B8IZ02wI.js",
				"/assets/ArrowDownward-BTmEZquC.js",
				"/assets/Search-DjMUdiZP.js",
				"/assets/Alert-CybrY8he.js",
				"/assets/TextField-DgrfbrhX.js",
				"/assets/Box-fDzbGWuk.js",
				"/assets/Typography-CDG8zr1j.js",
				"/assets/Checkbox-CeLK1xlk.js",
				"/assets/Divider-DnIxXSHB.js",
				"/assets/Stack-C61THOC7.js",
				"/assets/TableRow-CzK0MWOW.js",
				"/assets/axiosInstance-vP7tWF1p.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/cyclesApi-BiQvHHY_.js",
				"/assets/createTheme-CP-DPEC3.js",
				"/assets/DefaultPropsProvider-BlLYnZrj.js",
				"/assets/RtlProvider-CztOIY6k.js",
				"/assets/react-dom-0ZK-Lw7i.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/catch-all": {
			"id": "routes/catch-all",
			"parentId": "root",
			"path": "*",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/catch-all-Cx59GJLo.js",
			"imports": [
				"/assets/components-COO5XB0-.js",
				"/assets/jsx-runtime-fBfwind-.js",
				"/assets/routes-Bfwn16YJ.js",
				"/assets/react-B8IZ02wI.js",
				"/assets/hooks-WhnFmKJG.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-c97a4100.js",
	"version": "c97a4100",
	"sri": void 0
};
//#endregion
//#region \0virtual:react-router/server-build
var route1 = { default: () => null };
var route2 = { default: () => null };
var route3 = { default: () => null };
var route4 = { default: () => null };
var route5 = { default: () => null };
var route6 = { default: () => null };
var route7 = { default: () => null };
var route8 = { default: () => null };
var route9 = { default: () => null };
var route10 = { default: () => null };
var route11 = { default: () => null };
var route12 = { default: () => null };
var route13 = { default: () => null };
var route14 = { default: () => null };
var route15 = { default: () => null };
var assetsBuildDirectory = "build\\client";
var basename = "/";
var future = { "unstable_optimizeDeps": false };
var ssr = false;
var isSpaMode = true;
var prerender = [];
var routeDiscovery = { "mode": "initial" };
var publicPath = "/";
var entry = { module: entry_server_node_exports };
var routes = {
	"root": {
		id: "root",
		parentId: void 0,
		path: "",
		index: void 0,
		caseSensitive: void 0,
		module: root_exports
	},
	"routes/home": {
		id: "routes/home",
		parentId: "root",
		path: void 0,
		index: true,
		caseSensitive: void 0,
		module: route1
	},
	"routes/public-layout": {
		id: "routes/public-layout",
		parentId: "root",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: route2
	},
	"routes/login": {
		id: "routes/login",
		parentId: "routes/public-layout",
		path: "/login",
		index: void 0,
		caseSensitive: void 0,
		module: route3
	},
	"routes/sso-callback": {
		id: "routes/sso-callback",
		parentId: "routes/public-layout",
		path: "/auth/sso/callback",
		index: void 0,
		caseSensitive: void 0,
		module: route4
	},
	"routes/protected-layout": {
		id: "routes/protected-layout",
		parentId: "root",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: route5
	},
	"routes/dashboard": {
		id: "routes/dashboard",
		parentId: "routes/protected-layout",
		path: "/dashboard",
		index: void 0,
		caseSensitive: void 0,
		module: route6
	},
	"routes/cycle-detail": {
		id: "routes/cycle-detail",
		parentId: "routes/protected-layout",
		path: "/cycles/:id",
		index: void 0,
		caseSensitive: void 0,
		module: route7
	},
	"routes/self-assessment": {
		id: "routes/self-assessment",
		parentId: "routes/protected-layout",
		path: "/assessments/self",
		index: void 0,
		caseSensitive: void 0,
		module: route8
	},
	"routes/role-layout": {
		id: "routes/role-layout",
		parentId: "routes/protected-layout",
		path: void 0,
		index: void 0,
		caseSensitive: void 0,
		module: route9
	},
	"routes/cycles-list": {
		id: "routes/cycles-list",
		parentId: "routes/role-layout",
		path: "/cycles",
		index: void 0,
		caseSensitive: void 0,
		module: route10
	},
	"routes/kra-library": {
		id: "routes/kra-library",
		parentId: "routes/role-layout",
		path: "/kra-library",
		index: void 0,
		caseSensitive: void 0,
		module: route11
	},
	"routes/bulk-assignment": {
		id: "routes/bulk-assignment",
		parentId: "routes/role-layout",
		path: "/assignments",
		index: void 0,
		caseSensitive: void 0,
		module: route12
	},
	"routes/team-performance": {
		id: "routes/team-performance",
		parentId: "routes/role-layout",
		path: "/assessments/team",
		index: void 0,
		caseSensitive: void 0,
		module: route13
	},
	"routes/reports": {
		id: "routes/reports",
		parentId: "routes/role-layout",
		path: "/reports",
		index: void 0,
		caseSensitive: void 0,
		module: route14
	},
	"routes/catch-all": {
		id: "routes/catch-all",
		parentId: "root",
		path: "*",
		index: void 0,
		caseSensitive: void 0,
		module: route15
	}
};
var allowedActionOrigins = false;
//#endregion
export { allowedActionOrigins, server_manifest_default as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
