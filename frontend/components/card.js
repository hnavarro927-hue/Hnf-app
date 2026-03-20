export const createCard = ({ title, description, items }) => {
  const article = document.createElement('article');
  article.className = 'card';

  const list = items.map((item) => `<li>${item}</li>`).join('');
  article.innerHTML = `
    <h3>${title}</h3>
    <p class="muted">${description}</p>
    <ul>${list}</ul>
  `;

  return article;
};
