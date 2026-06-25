import { jsx, jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useEffect, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import axios from "axios";
//#region src/config/env.js
var env = {
	API_BASE_URL: "http://localhost:8000/api/v1/",
	SUPABASE_URL: "",
	SUPABASE_ANON_KEY: "",
	SSO_CLIENT_ID: "",
	SSO_REDIRECT_URI: typeof window !== "undefined" ? `${window.location.origin}/auth/sso/callback` : "/auth/sso/callback"
};
//#endregion
//#region src/api/axiosInstance.js
/**
* Axios instance — Django session-cookie auth.
* Set-Cookie is issued by the backend on login;
* withCredentials ensures the browser attaches it automatically.
*/
var axiosInstance = axios.create({
	baseURL: env.API_BASE_URL,
	headers: { "Content-Type": "application/json" },
	withCredentials: true
});
axiosInstance.interceptors.response.use((res) => res, (error) => {
	if (error.response?.status === 401) window.dispatchEvent(new CustomEvent("kra:unauthorized"));
	return Promise.reject(error);
});
//#endregion
//#region src/auth/services/authService.js
/**
* authService — wraps Django session-based auth endpoints.
*
* POST /kra/auth/login  → { session_id, employee_id, roles, full_name, department }
* POST /kra/auth/logout → { message }
*/
var authService = {
	async login(email, password) {
		return (await axiosInstance.post("auth/login", {
			email,
			password
		})).data;
	},
	async logout() {
		try {
			await axiosInstance.post("auth/logout");
		} catch {}
	}
};
//#endregion
//#region src/api/authApi.js
/**
* authApi — thin wrappers around Django session-based auth endpoints.
*
* POST /api/v1/auth/login   → { session_id, employee_id, roles, full_name, department }
* POST /api/v1/auth/logout  → { message }
* GET  /api/v1/auth/me      → same shape as login response (session validation)
*/
var authApi = {
	login: (email, password) => axiosInstance.post("auth/login", {
		email,
		password
	}),
	logout: () => axiosInstance.post("auth/logout"),
	/**
	* Validate the existing session cookie and return the current user.
	* Called on app mount to restore persisted auth state.
	* The backend should return 401 if no valid session exists.
	*/
	me: () => axiosInstance.get("auth/me")
};
//#endregion
//#region src/auth/AuthProvider.jsx
var AuthContext = createContext(null);
function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(false);
	const [initialized, setInitialized] = useState(false);
	useEffect(() => {
		authApi.me().then((res) => {
			console.log("ME RESPONSE:", res.data);
			setUser({
				employee_id: res.data.id,
				full_name: res.data.full_name,
				roles: res.data.roles,
				department: res.data.department
			});
		}).catch(() => {
			setUser(null);
		}).finally(() => {
			setInitialized(true);
		});
	}, []);
	useEffect(() => {
		const handleUnauthorized = () => setUser(null);
		window.addEventListener("kra:unauthorized", handleUnauthorized);
		return () => window.removeEventListener("kra:unauthorized", handleUnauthorized);
	}, []);
	const login = useCallback(async (email, password) => {
		setLoading(true);
		try {
			const data = await authService.login(email, password);
			setUser({
				employee_id: data.employee_id,
				full_name: data.full_name,
				roles: data.roles,
				department: data.department
			});
			return { success: true };
		} catch (err) {
			return {
				success: false,
				error: err?.response?.data?.error || err?.response?.data?.detail || "Invalid credentials. Please try again."
			};
		} finally {
			setLoading(false);
		}
	}, []);
	const logout = useCallback(async () => {
		await authService.logout();
		setUser(null);
	}, []);
	if (!initialized) return null;
	return /* @__PURE__ */ jsx(AuthContext.Provider, {
		value: {
			user,
			loading,
			login,
			logout
		},
		children
	});
}
//#endregion
//#region src/ClientApp.jsx
/**
* ClientApp.jsx — Client-only wrapper for MUI + AuthProvider.
*
* This module is imported lazily inside root.jsx so that @mui/material
* (which accesses `document` and `window` at module evaluation time) is
* NEVER evaluated during Node-side SSR or build-time prerender.
*
* The framework calls root.jsx in Node; React.lazy ensures this file
* only executes in the browser where DOM APIs are available.
*/
var theme = createTheme({
	palette: {
		primary: { main: "#1E3A8A" },
		secondary: { main: "#2d4fd6" },
		background: {
			default: "#f5f6fa",
			paper: "#ffffff"
		}
	},
	typography: { fontFamily: "\"Inter\", -apple-system, BlinkMacSystemFont, sans-serif" },
	shape: { borderRadius: 10 },
	components: {
		MuiButton: { styleOverrides: { root: {
			textTransform: "none",
			fontWeight: 600,
			borderRadius: 8
		} } },
		MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } }
	}
});
function ClientApp({ children }) {
	return /* @__PURE__ */ jsxs(ThemeProvider, {
		theme,
		children: [/* @__PURE__ */ jsx(CssBaseline, {}), /* @__PURE__ */ jsx(AuthProvider, { children })]
	});
}
//#endregion
export { ClientApp as default };
