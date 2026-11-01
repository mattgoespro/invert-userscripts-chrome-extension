import { useId } from "react";

type InvertLogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** The Invert mark (resources/logo.svg): two interlocking chevrons. */
export function InvertLogo({
  size = 28,
  className,
  title = "Invert",
}: InvertLogoProps) {
  const id = useId();
  const gradient = (name: string): string => `${id}-${name}`;

  return (
    <svg
      viewBox="46 46 932 932"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient
          id={gradient("left")}
          gradientUnits="userSpaceOnUse"
          x1="300"
          y1="80"
          x2="480"
          y2="780"
        >
          <stop offset="0" stopColor="#38a9f3" />
          <stop offset="1" stopColor="#0b439c" />
        </linearGradient>
        <linearGradient
          id={gradient("foot")}
          gradientUnits="userSpaceOnUse"
          x1="300"
          y1="700"
          x2="140"
          y2="950"
        >
          <stop offset="0" stopColor="#034a98" />
          <stop offset="1" stopColor="#1279b7" />
        </linearGradient>
        <linearGradient
          id={gradient("top")}
          gradientUnits="userSpaceOnUse"
          x1="800"
          y1="70"
          x2="720"
          y2="330"
        >
          <stop offset="0" stopColor="#2f8fea" />
          <stop offset="1" stopColor="#1a68cf" />
        </linearGradient>
        <linearGradient
          id={gradient("right")}
          gradientUnits="userSpaceOnUse"
          x1="500"
          y1="420"
          x2="880"
          y2="760"
        >
          <stop offset="0" stopColor="#2a92e8" />
          <stop offset="1" stopColor="#2fc7eb" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradient("left")})`}
        points="617,58 316,58 284,70 255,105 57,437 51,463 60,486 251,683 422,859 511,713 527,673 402,485 394,453"
      />
      <polygon
        fill={`url(#${gradient("foot")})`}
        points="251,683 109,933 116,955 346,958 366,951 422,859"
      />
      <polygon
        fill={`url(#${gradient("top")})`}
        points="720,58 876,60 887,70 885,89 749,334 611,205 693,67"
      />
      <polygon
        fill={`url(#${gradient("right")})`}
        points="611,205 749,334 956,553 966,577 961,609 800,886 756,945 718,959 451,958 454,934 605,680 465,467 463,452"
      />
    </svg>
  );
}
