import React from "react";
// Aapke baqi existing imports
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  MessageCircle, Send, Search, LogOut, Users, ShieldCheck,
  CheckCheck, Menu, X, LoaderCircle, Sparkles
} from "lucide-react";
import api, { API_URL } from "./api";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("chatsphere_token"));
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chatsphere_user") || "null"); }
    catch { return null; }
  });
  const [mode, setMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const bottomRef = useRef(null);
  const activeUserRef = useRef(null);

  useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);

  useEffect(() => {
    if (!token || !me) return;
    let currentSocket;
    let cancelled = false;

    async function initialize() {
      setLoadingUsers(true);
      try {
        const { data } = await api.get("/users");
        if (!cancelled) {
          setUsers(data);
          if (data.length && !activeUserRef.current) setActiveUser(data[0]);
        }
      } catch (error) {
        if (error.response?.status === 401) logout();
        else setNotice(error.response?.data?.message || "Could not load users.");
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }

      currentSocket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
      currentSocket.on("connect_error", (error) => {
        if (!cancelled) setNotice(error.message || "Chat connection failed.");
      });
      currentSocket.on("online-users", (ids) => {
        if (!cancelled) setOnlineUsers(ids.map(String));
      });
      currentSocket.on("new-message", (message) => {
        if (cancelled) return;
        const selected = activeUserRef.current;
        const selectedId = String(selected?._id || "");
        const senderId = String(message.sender);
        const receiverId = String(message.receiver);
        if (selectedId && (senderId === selectedId || receiverId === selectedId)) {
          setMessages((previous) => {
            if (previous.some((item) => String(item._id) === String(message._id))) return previous;
            return [...previous, message];
          });
        }
      });
      if (!cancelled) setSocket(currentSocket);
    }

    initialize();
    return () => {
      cancelled = true;
      currentSocket?.disconnect();
      setSocket(null);
    };
    // Socket lifecycle follows the logged-in session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me?._id]);

  useEffect(() => {
    if (!token || !activeUser) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const { data } = await api.get(`/messages/${activeUser._id}`);
        if (!cancelled) setMessages(data);
      } catch (error) {
        if (!cancelled) setNotice(error.response?.data?.message || "Could not load conversation.");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    loadMessages();
    return () => { cancelled = true; };
  }, [activeUser?._id, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeUser]);

  function logout() {
    socket?.disconnect();
    localStorage.removeItem("chatsphere_token");
    localStorage.removeItem("chatsphere_user");
    setToken(null);
    setMe(null);
    setUsers([]);
    setActiveUser(null);
    setMessages([]);
    setSocket(null);
    setOnlineUsers([]);
    setNotice("");
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
      const payload = mode === "signup"
        ? authForm
        : { email: authForm.email, password: authForm.password };
      const { data } = await api.post(endpoint, payload);
      localStorage.setItem("chatsphere_token", data.token);
      localStorage.setItem("chatsphere_user", JSON.stringify(data.user));
      setToken(data.token);
      setMe(data.user);
      setAuthForm({ username: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.response?.data?.message || "Something went wrong. Is the backend running?");
    } finally {
      setAuthBusy(false);
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeUser || !socket || !socket.connected) {
      if (!socket?.connected) setNotice("Chat server is reconnecting. Please try again.");
      return;
    }
    setDraft("");
    socket.emit("private-message", { receiverId: activeUser._id, text }, (result) => {
      if (!result?.ok) {
        setDraft(text);
        setNotice(result?.message || "Message could not be sent.");
      } else {
        setNotice("");
      }
    });
  }

  const filteredUsers = users.filter((user) =>
    `${user.username} ${user.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (!token || !me) {
    return (
      <main className="auth-page">
        <section className="auth-art">
          <div className="brand brand-light"><span className="brand-icon"><MessageCircle size={22} /></span> ChitChat</div>
          <div className="art-content">
            <div className="eyebrow"><Sparkles size={15} /> YOUR PEOPLE, YOUR SPACE</div>
            <h1>Good conversations<br /><span>start here.</span></h1>
            <p>A calmer place to catch up, share ideas, and stay close to the people who matter.</p>
            <div className="chat-preview">
              <div className="preview-avatar purple">QA</div>
              <div className="preview-copy"><strong>Muhammad Qadeer</strong><span>That sounds like a plan! ✨</span></div>
              <span className="preview-time">now</span>
            </div>
            <div className="floating-dot dot-one" /><div className="floating-dot dot-two" />
          </div>
          <div className="art-footer"><ShieldCheck size={15} /> A simple space for meaningful conversations</div>
        </section>
        <section className="auth-panel">
          <div className="mobile-brand brand"><span className="brand-icon"><MessageCircle size={22} /></span> ChitChat</div>
          <div className="auth-box">
            <div className="auth-icon"><MessageCircle size={24} /></div>
            <p className="section-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
            <h2>{mode === "login" ? "Sign in to ChitChat" : "Create your account"}</h2>
            <p className="muted">{mode === "login" ? "Your conversations are just a moment away." : "Join in and start a conversation."}</p>
            <form onSubmit={handleAuth} className="auth-form">
              {mode === "signup" && <label>Your name<input autoComplete="name" placeholder="e.g. Qadeer" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} minLength={3} required /></label>}
              <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required /></label>
              <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} minLength={8} required /></label>
              {authError && <div className="error-message">{authError}</div>}
              <button className="primary-button" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" size={18} /> : null}{mode === "login" ? "Sign in" : "Create account"} <span>→</span></button>
            </form>
            <p className="switch-auth">{mode === "login" ? "New to ChatSphere?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setAuthError(""); }}> {mode === "login" ? "Create account" : "Sign in"}</button></p>
            <div className="auth-security"><ShieldCheck size={15} /> Your password is securely hashed before storage.</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {mobileSidebar && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setMobileSidebar(false)} />}
      <aside className={`sidebar ${mobileSidebar ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand brand"><span className="brand-icon"><MessageCircle size={21} /></span> ChitChat <button className="mobile-close icon-button" onClick={() => setMobileSidebar(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="sidebar-heading"><span>MESSAGES</span><span className="count-pill">{users.length}</span></div>
        <div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." /></div>
        <div className="people-list">
          {loadingUsers ? <div className="empty-small"><LoaderCircle className="spin" size={20} /> Loading people...</div> :
            filteredUsers.length ? filteredUsers.map((user, index) => {
              const isOnline = onlineUsers.includes(String(user._id));
              const isActive = activeUser?._id === user._id;
              return <button key={user._id} className={`person-row ${isActive ? "person-active" : ""}`} onClick={() => { setActiveUser(user); setMobileSidebar(false); setNotice(""); }}>
                <div className={`avatar avatar-${index % 5}`}>{initials(user.username)}{isOnline && <i className="online-dot" />}</div>
                <div className="person-info"><strong>{user.username}</strong><span>{isOnline ? "Online now" : user.email}</span></div>
                {isActive && <span className="active-mark" />}
              </button>;
            }) : <div className="empty-small"><Users size={22} /><span>{users.length ? "No matching people" : "No other users yet. Create another account in a second browser to test chat."}</span></div>}
        </div>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="avatar avatar-me">{initials(me.username)}</div><div className="person-info"><strong>{me.username}</strong><span>My account</span></div><button className="icon-button logout-button" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={17} /></button></div>
          <div className="sidebar-note"><span className="note-dot" /> Connected to your space</div>
        </div>
      </aside>

      <section className="chat-area">
        <header className="chat-header">
          <button className="icon-button mobile-menu" onClick={() => setMobileSidebar(true)} aria-label="Open menu"><Menu size={21} /></button>
          {activeUser ? <>
            <div className="avatar header-avatar">{initials(activeUser.username)}{onlineUsers.includes(String(activeUser._id)) && <i className="online-dot" />}</div>
            <div className="header-person"><h2>{activeUser.username}</h2><p><span className={`status-dot ${onlineUsers.includes(String(activeUser._id)) ? "is-online" : ""}`} />{onlineUsers.includes(String(activeUser._id)) ? "Online now" : "Offline"}</p></div>
            <div className="header-secure"><ShieldCheck size={16} /><span>Private conversation</span></div>
          </> : <div className="header-person"><h2>Your messages</h2><p>Choose someone to start chatting</p></div>}
        </header>

        {notice && <div className="notice-banner">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

        {activeUser ? <>
          <div className="conversation-intro"><div className="intro-line" /><span>THIS IS THE BEGINNING OF YOUR CONVERSATION</span><div className="intro-line" /></div>
          <div className="messages-area">
            {loadingMessages ? <div className="loading-state"><LoaderCircle className="spin" size={23} /><span>Loading messages...</span></div> :
              messages.length === 0 ? <div className="empty-chat"><div className="empty-chat-icon"><MessageCircle size={27} /></div><h3>Say hello to {activeUser.username.split(" ")[0]}</h3><p>Start a conversation. Your messages will appear here.</p></div> :
              messages.map((message) => {
                const own = String(message.sender) === String(me._id);
                return <div key={message._id} className={`message-row ${own ? "message-own" : ""}`}>
                  {!own && <div className="avatar message-avatar">{initials(activeUser.username)}</div>}
                  <div className="message-content"><div className={`message-bubble ${own ? "bubble-own" : "bubble-other"}`}>{message.text}</div><div className="message-meta">{formatTime(message.createdAt)} {own && <CheckCheck size={14} className="read-check" />}</div></div>
                </div>;
              })}
            <div ref={bottomRef} />
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <div className="composer-inner"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${activeUser.username}...`} maxLength={5000} aria-label="Message text" /><span className="composer-hint">Enter to send</span><button className="send-button" disabled={!draft.trim() || !socket?.connected} aria-label="Send message"><Send size={18} /></button></div>
            <div className="composer-footer"><span><ShieldCheck size={13} /> Be kind. Keep it respectful.</span><span>{draft.length}/5000</span></div>
          </form>
        </> : <div className="welcome-state"><div className="welcome-illustration"><MessageCircle size={42} /></div><h2>Your conversations, all in one place.</h2><p>Select a person from the sidebar to start a private chat.</p></div>}
      </section>
    </main>
  );
}
