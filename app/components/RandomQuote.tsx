import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getRandomQuote, type Quote } from "~/utils/quotes";
import { Button } from "~/ui/Button";

export default function RandomQuote() {
  const { t, i18n } = useTranslation();
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);

  useEffect(() => {
    setCurrentQuote(getRandomQuote());
  }, []);

  const handleGetNewQuote = () => {
    setCurrentQuote(getRandomQuote());
  };

  if (!currentQuote) {
    return null;
  }

  const quoteText =
    i18n.language === "vi" ? currentQuote.vi : currentQuote.en;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white/15 dark:bg-white/5 backdrop-blur-lg rounded-3xl shadow-xl p-8 border border-white/20 dark:border-white/10">
        {/* Quote Text */}
        <blockquote className="text-xl md:text-2xl leading-relaxed text-gray-900 dark:text-gray-100 italic mb-6">
          "{quoteText}"
        </blockquote>

        {/* Source */}
        {currentQuote.source && (
          <p className="text-right text-sm md:text-base text-gray-600 dark:text-gray-400 mb-8">
            — {currentQuote.source}
          </p>
        )}

        {/* Button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={handleGetNewQuote}>
            {t("quotes.button_next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
