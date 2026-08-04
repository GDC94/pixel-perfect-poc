import './Card.css';

type CardProps = {
  title: string;
  body: string;
  elevated?: boolean;
};

export function Card({ title, body, elevated = false }: CardProps) {
  return (
    <article className={`card${elevated ? ' card--elevated' : ''}`}>
      <span className="card__rule" />
      <h3 className="card__title">{title}</h3>
      <p className="card__body">{body}</p>
    </article>
  );
}
