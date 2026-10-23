import './polyfills'; // 必须最先加载：Safari 兼容补丁
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
