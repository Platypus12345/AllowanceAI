const JAR_CATEGORIES = ['Travel', 'Tech', 'Health', 'Emergency', 'Fun', 'Other'];

const JAR_CATEGORY_META = {
  Travel: { icon: '✈️', color: '#44e2cd' },
  Tech: { icon: '💻', color: '#8083ff' },
  Health: { icon: '🏥', color: '#34d399' },
  Emergency: { icon: '🚨', color: '#f87171' },
  Fun: { icon: '🎉', color: '#fbbf24' },
  Other: { icon: '🎯', color: '#a78bfa' },
};

function getJarDefaults(category) {
  const meta = JAR_CATEGORY_META[category] || JAR_CATEGORY_META.Other;
  return { icon: meta.icon, color: meta.color };
}

module.exports = { JAR_CATEGORIES, JAR_CATEGORY_META, getJarDefaults };
