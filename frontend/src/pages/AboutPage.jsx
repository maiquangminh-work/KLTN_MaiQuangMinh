import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useMarketData } from '../contexts/MarketDataContext';
import AboutSection from '../components/AboutSectionStudio';

export default function AboutPage() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { ticker } = useMarketData();

  return (
    <AboutSection
      language={language}
      onOpenChart={() => navigate(`/chart/${ticker}`)}
      onOpenNews={() => navigate(`/news/${ticker}`)}
    />
  );
}
