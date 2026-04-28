/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('vi');

  const isLightTheme = theme === 'light';

  const chartTheme = useMemo(
    () => ({
      chartBg: isLightTheme ? '#fbfdff' : '#161a1e',
      textColor: isLightTheme ? '#3d5166' : '#848e9c',
      gridColor: isLightTheme ? '#d7e2ee' : '#2b3139',
      borderColor: isLightTheme ? '#c5d1df' : '#2b3139',
      tooltipBg: isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(30, 35, 41, 0.85)',
      tooltipBorder: isLightTheme ? '#aebdcd' : '#2b3139',
    }),
    [isLightTheme]
  );

  useEffect(() => {
    const pageBg = isLightTheme ? '#e8eef5' : '#0b0e11';
    const pageText = isLightTheme ? '#172333' : '#eaecef';

    document.body.style.backgroundColor = pageBg;
    document.body.style.color = pageText;
    document.documentElement.style.backgroundColor = pageBg;

    const rootNode = document.getElementById('root');
    if (rootNode) {
      rootNode.style.backgroundColor = pageBg;
      rootNode.style.minHeight = '100vh';
    }

    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.documentElement.style.backgroundColor = '';
      if (rootNode) {
        rootNode.style.backgroundColor = '';
        rootNode.style.minHeight = '';
      }
    };
  }, [isLightTheme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      language,
      setLanguage,
      isLightTheme,
      chartTheme,
    }),
    [theme, language, isLightTheme, chartTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
