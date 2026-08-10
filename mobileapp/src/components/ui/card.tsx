import React from "react";
import { Card as HCard } from "heroui-native";

type HCardProps = React.ComponentProps<typeof HCard>;

interface CardProps extends HCardProps {
  title?: string;
  subtitle?: string;
}

/**
 * Surface container with an optional heading. `title`/`subtitle` cover the
 * common case; for richer layouts use HeroUI's compound parts directly
 * (`Card.Header` / `Card.Body` / `Card.Footer`).
 */
export function Card({ title, subtitle, children, ...props }: CardProps) {
  return (
    <HCard {...props}>
      <HCard.Body>
        {title && <HCard.Title>{title}</HCard.Title>}
        {subtitle && <HCard.Description>{subtitle}</HCard.Description>}
        {children}
      </HCard.Body>
    </HCard>
  );
}
