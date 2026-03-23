export const createCard = ({ title, description, items }) => {
  const article = document.createElement('article');
  article.className = 'card';

  const list = items.map((item) => `<li>${item}</li>`).join('');
  article.innerHTML = `
    <h3 class="card__title">${title}</h3>
    <p class="card__desc muted">${description}</p>
    <ul class="card__list">${list}</ul>
  `;

  return article;
};
