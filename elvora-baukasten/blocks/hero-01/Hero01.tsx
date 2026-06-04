import { Button } from '../../primitives/Button';
import { ArrowRight, ChevronRight } from 'lucide-react';

export interface HeroCtaProps {
  label: string;
  href: string;
}

export interface TrustLogo {
  src: string;
  alt: string;
  width?: number;
}

export interface Hero01Props {
  headline: string;
  subline: string;
  ctaPrimary: HeroCtaProps;
  ctaSecondary?: HeroCtaProps;
  image: { src: string; alt: string };
  trustLogos?: TrustLogo[];
  variant?: 'imageRight' | 'imageLeft';
}

export function Hero01({
  headline,
  subline,
  ctaPrimary,
  ctaSecondary,
  image,
  trustLogos,
  variant = 'imageRight',
}: Hero01Props) {
  const isReversed = variant === 'imageLeft';

  return (
    <section className="relative overflow-hidden bg-[#0A0A0B]">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28 lg:px-8 lg:py-32">
        <div
          className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${isReversed ? 'lg:[direction:rtl]' : ''}`}
        >
          {/* Text */}
          <div className={`flex flex-col gap-6 ${isReversed ? 'lg:[direction:ltr]' : ''}`}>
            <h1 className="text-4xl font-bold tracking-tight text-[#FAFAFA] md:text-5xl lg:text-6xl">
              {headline}
            </h1>

            <p className="max-w-prose text-lg leading-relaxed text-[#A1A1AA]">
              {subline}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="lg">
                <a href={ctaPrimary.href}>
                  {ctaPrimary.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>

              {ctaSecondary && (
                <Button asChild variant="secondary" size="lg">
                  <a href={ctaSecondary.href}>
                    {ctaSecondary.label}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>

            {trustLogos && trustLogos.length > 0 && (
              <div className="flex flex-col gap-3 pt-6">
                <span className="text-xs font-medium uppercase tracking-widest text-[#636366]">
                  Vertraut von
                </span>
                <div className="flex flex-wrap items-center gap-6">
                  {trustLogos.map((logo) => (
                    <img
                      key={logo.alt}
                      src={logo.src}
                      alt={logo.alt}
                      width={logo.width ?? 100}
                      className="h-6 w-auto opacity-50 grayscale transition-opacity duration-200 hover:opacity-80"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Image */}
          <div className={`relative ${isReversed ? 'lg:[direction:ltr]' : ''}`}>
            <div className="overflow-hidden rounded-2xl border border-[#26262A]">
              <img
                src={image.src}
                alt={image.alt}
                className="h-auto w-full object-cover"
              />
            </div>
            {/* Subtle glow behind image */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-[#E1106E]/8 to-[#FF6A3D]/5 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
