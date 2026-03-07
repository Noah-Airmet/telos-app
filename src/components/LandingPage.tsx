import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";
import { useAuth } from "../context/AuthContext";

export function LandingPage() {
  const { signIn, status } = useAuth();
  const cursorRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const mouseXRef = useRef<HTMLSpanElement>(null);
  const mouseYRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAlpha, setShowAlpha] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loadingExiting, setLoadingExiting] = useState(false);
  const [loadingMounted, setLoadingMounted] = useState(true);
  const loadingPercentRef = useRef<HTMLSpanElement>(null);

  // Loading screen — runs once on mount, exits when image is ready AND min time elapsed
  useEffect(() => {
    const MIN_MS = 2400;
    const start = Date.now();
    let rafId: number;
    let imageReady = false;
    let minDone = false;

    const beginExit = () => {
      setLoadingExiting(true);
      setTimeout(() => setLoadingMounted(false), 900);
    };

    const tryExit = () => {
      if (imageReady && minDone) beginExit();
    };

    // Drive the percentage counter via RAF (no React state, no re-renders)
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(Math.floor((elapsed / MIN_MS) * 100), 100);
      if (loadingPercentRef.current) {
        loadingPercentRef.current.innerText = String(pct).padStart(3, '0');
      }
      if (pct < 100) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Minimum display timer
    const timer = setTimeout(() => {
      minDone = true;
      tryExit();
    }, MIN_MS);

    // Image load detection (independent from the imageLoaded state below)
    const loaderImg = new Image();
    loaderImg.onload = () => { imageReady = true; tryExit(); };
    loaderImg.onerror = () => { imageReady = true; tryExit(); }; // fail-safe: don't block on 404
    loaderImg.src = '/christ-in-the-storm.jpg';

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check if local image exists
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = "/christ-in-the-storm.jpg";

    // Detect mobile device (rough heuristic)
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let scrollProgress = 0;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Update edge indicators directly without React re-renders
      if (mouseXRef.current) {
        // Pad to 4 digits for that precise instrumental look, e.g., "0493 X 1680 W"
        mouseXRef.current.innerText = `${String(mouseX).padStart(4, '0')} X ${window.innerWidth} W`;
      }
      if (mouseYRef.current) {
        mouseYRef.current.innerText = `${String(mouseY).padStart(4, '0')} Y ${window.innerHeight} H`;
      }
    };

    // Initialize clock interval
    const updateClock = () => {
      if (clockRef.current) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        clockRef.current.innerText = `SLC, UT_${timeStr}`;
      }
    };
    updateClock();
    const clockIntervalId = setInterval(updateClock, 1000);

    const handleScroll = () => {
      if (mainRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll > 0) {
          const rawProgress = scrollTop / maxScroll;
          // Global progress bar update
          if (progressBarRef.current) {
            progressBarRef.current.style.width = `${rawProgress * 100}%`;
            // Fade out the progress bar at the very bottom to prevent overlapping text
            if (rawProgress > 0.95) {
              // Map 0.95-1.0 to 1-0 opacity
              const fade = Math.max(0, 1 - (rawProgress - 0.95) * 20);
              progressBarRef.current.parentElement!.style.opacity = fade.toString();
            } else {
              progressBarRef.current.parentElement!.style.opacity = "1";
            }
          }
          // Trigger the background fade early — scripture + "upgrade" sections are
          // roughly the first ~40% of the page, so complete the transition by then.
          scrollProgress = Math.max(0, Math.min(1, (rawProgress - 0.12) / 0.15));
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll);
      // Trigger initial calculate
      handleScroll();
    }

    const render = () => {
      // Ease cursor position with a smaller factor for a smoother, buttery trailing delay
      cursorX += (mouseX - cursorX) * 0.08;
      cursorY += (mouseY - cursorY) * 0.08;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(calc(${cursorX}px - 50%), calc(${cursorY}px - 50%))`;
      }

      // Parallax text + Scroll Progress for Filter/Shift
      if (bgRef.current) {
        const xPos = (mouseX / window.innerWidth - 0.5) * 40;
        const yPosParallax = (mouseY / window.innerHeight - 0.5) * 40;

        // Shift image up relative to viewport (panning down image) by up to 15% of its height based on scroll
        const scrollShiftY = scrollProgress * -15;

        bgRef.current.style.transform = `translate(${xPos}px, calc(${yPosParallax}px + ${scrollShiftY}%)) scale(1.05)`;

        // Dynamically compute filters based on scrollProgress
        // Transition from grayscale(100) -> 0, contrast(160) -> 100, brightness(0.8) -> 0.5
        const currentGrayscale = 100 - (scrollProgress * 100);
        const currentContrast = 160 - (scrollProgress * 60);
        const currentBrightness = 0.8 - (scrollProgress * 0.3);

        bgRef.current.style.filter = `grayscale(${currentGrayscale}%) contrast(${currentContrast}%) brightness(${currentBrightness})`;
      }

      // Fade out the overlay tint
      if (overlayRef.current) {
        overlayRef.current.style.opacity = `${1 - scrollProgress}`;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Observer logic
    const reveals = document.querySelectorAll('.reveal');
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.2
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    reveals.forEach(reveal => {
      observer.observe(reveal);
    });

    // Trigger initial reveals
    setTimeout(() => {
      reveals.forEach(reveal => {
        const rect = reveal.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          reveal.classList.add('visible');
        }
      });
    }, 100);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener('resize', checkMobile);
      if (mainEl) {
        mainEl.removeEventListener("scroll", handleScroll);
      }
      clearInterval(clockIntervalId);
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, []);

  const handleMouseEnter = () => {
    cursorRef.current?.classList.add("active");
  };

  const handleMouseLeave = () => {
    cursorRef.current?.classList.remove("active");
  };

  return (
    <div className="landing-page-root antialiased selection:bg-white selection:text-black">
      {/* Loading Screen — slides up to reveal the page once the image is loaded */}
      {loadingMounted && (
        <div className={`loading-screen${loadingExiting ? ' exiting' : ''}`}>
          <div className="loading-wordmark">TELOS</div>
          <div className="loading-core">
            <div className="loading-vline"></div>
            <span ref={loadingPercentRef} className="loading-pct">000</span>
            <div className="loading-vline"></div>
          </div>
          <div className="loading-status">INITIALIZING</div>
        </div>
      )}

      {/* Custom Pointer */}
      <div className="custom-cursor" id="custom-cursor" ref={cursorRef}></div>

      {/* Background Parallax Setup */}
      <div className="bg-container">
        <div
          className={`dithered-bg ${!imageLoaded ? "remote-fallback" : ""}`}
          id="dithered-bg"
          ref={bgRef}
        ></div>
        <div className="noise"></div>
        <div className="overlay-tint" ref={overlayRef}></div>
      </div>

      {/* Main Foreground Content */}
      <div
        className="relative z-10 w-full h-[100dvh]"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, transparent 40px, black 160px)',
          maskImage: 'linear-gradient(to bottom, transparent 0px, transparent 40px, black 160px)'
        }}
      >
        <main ref={mainRef} className="w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth">
          {/* Section 1: First Two Verses */}
          <section className="min-h-[150vh] flex flex-col justify-between px-6 md:px-12 pt-[30vh]">
            <div className="max-w-2xl text-2xl md:text-5xl leading-tight text-left ml-4 md:ml-[10vw]">
              <p className="scripture reveal">
                And waking up, he rebuked the wind and said to the sea, “Be silent! Be still!” Then the wind ceased, and there was a dead calm.
              </p>
            </div>

            <div className="max-w-2xl text-2xl md:text-5xl leading-tight text-right self-end mr-4 md:mr-[10vw] mt-[40vh]">
              <p className="scripture reveal">
                He said to them, “Why are you afraid?<br />Have you still no faith?”
              </p>
            </div>
          </section>

          {/* Section 2: The Third Verse */}
          <section className="min-h-[80vh] flex flex-col justify-center px-6 md:px-12 py-[20vh]">
            <div className="max-w-2xl text-2xl md:text-5xl leading-tight text-left ml-4 md:ml-[20vw]">
              <p className="scripture reveal">
                And they were filled with great fear and said to one another, “Who then is this, that even the wind and the sea obey him?”
              </p>
            </div>
          </section>

          {/* Section 2: Core Question */}
          <section className="min-h-[100vh] flex items-center justify-center px-6 md:px-12 mb-[10vh]">
            <h1 className="massive-header text-center reveal w-full leading-none">
              Gospel Library<br />
              deserves an<br />
              Upgrade
            </h1>
          </section>

          {/* Section 3: Feature Declarations */}
          <section className="px-6 md:px-12">
            {/* 001 - PARALLEL - Left */}
            <div className="min-h-[60vh] flex items-center">
              <div className="ml-4 md:ml-[10vw]">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>001</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  COMPARE
                </h2>
                <p className="feature-desc reveal reveal-delay-2">
                  Side-by-side translations synced verse-by-verse.<br />
                  KJV left, NRSVue right. One scroll drives both.
                </p>
              </div>
            </div>

            {/* 002 - COMMAND - Right */}
            <div className="min-h-[60vh] flex items-center justify-end">
              <div className="mr-4 md:mr-[10vw] text-right">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>002</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  COMMAND
                </h2>
                <p className="feature-desc reveal reveal-delay-2 ml-auto">
                  Cmd+K. Type "alma 32" and you're there.<br />
                  No menus, no drill-downs, no waiting.
                </p>
              </div>
            </div>

            {/* 003 - PLAN - Left offset */}
            <div className="min-h-[60vh] flex items-center">
              <div className="ml-4 md:ml-[15vw]">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>003</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  PLAN
                </h2>
                <p className="feature-desc reveal reveal-delay-2">
                  Built for serious notes and lesson planning.<br />
                  Dedicated workspace for organizing your thoughts.
                </p>
              </div>
            </div>

            {/* 004 - ANCHORED - Right */}
            <div className="min-h-[60vh] flex items-center justify-end">
              <div className="mr-4 md:mr-[10vw] text-right">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>004</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  CONTEXT
                </h2>
                <p className="feature-desc reveal reveal-delay-2 ml-auto">
                  Reference commentaries,<br />
                  study bibles,<br />
                  historical guides and more.
                </p>
              </div>
            </div>

            {/* 005 - LOOKUP - Left */}
            <div className="min-h-[60vh] flex items-center">
              <div className="ml-4 md:ml-[10vw]">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>005</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  LOOKUP
                </h2>
                <p className="feature-desc reveal reveal-delay-2">
                  Import your own dictionary. Click any word.<br />
                  1828 Webster's on a single tap.
                </p>
              </div>
            </div>

            {/* 006 - KEYBOARD - Center */}
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center">
                <p className="feature-index reveal interactive" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>006</p>
                <h2 className="massive-header reveal reveal-delay-1" style={{ fontSize: "clamp(3rem, 12vw, 12rem)" }}>
                  KEYBOARD
                </h2>
                <p className="feature-desc reveal reveal-delay-2 mx-auto">
                  Built for a desk, not a thumb. Arrows, shortcuts,<br />
                  split panes. A desktop app that acts like one.
                </p>
              </div>
            </div>

            {/* Spacer before Marquee to avoid KEYBOARD overlapping */}
            <div className="h-[20vh] md:h-[30vh]"></div>
          </section>

          {/* Marquee Divider */}
          <div className="py-12 overflow-hidden border-t border-b border-white/10">
            <div className="marquee-track">
              {[...Array(2)].map((_, i) => (
                <span key={i} className="flex">
                  {["COMPARE", "COMMAND", "PLAN", "CONTEXT", "LOOKUP", "KEYBOARD", "PARALLEL", "ANCHORED"].map((word) => (
                    <span key={`${i}-${word}`} className="marquee-word">{word} &mdash;&mdash;&mdash;</span>
                  ))}
                </span>
              ))}
            </div>
          </div>

          {/* Spacer before Introducing TELOS to prevent layout jump overlap */}
          <div className="h-[30vh] md:h-[50vh]"></div>

          {/* Section 4: TELOS & Login */}
          <section className="min-h-screen flex flex-col justify-center px-6 md:px-12 pb-[10vh]">
            {/* Pre-title context */}
            <p className="scripture text-center text-3xl md:text-4xl reveal mb-8">
              Introducing
            </p>

            {/* Real Title */}
            <h1
              className="font-black text-center text-[#ffffff] mix-blend-difference uppercase leading-none tracking-tighter w-full reveal font-sans"
              style={{ fontSize: "clamp(6rem, 25vw, 25rem)", letterSpacing: "-0.06em" }}
            >
              TELOS
            </h1>

            {/* Announcement Card */}
            <div className="w-full max-w-lg mx-auto bg-[#0a0a0a] bg-opacity-[0.85] p-8 md:p-12 border border-white/10 backdrop-blur-xl hover:border-white/30 transition-colors duration-500 reveal group shadow-2xl mt-12 md:mt-20 relative z-20">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

              <div className="flex justify-between items-end border-b border-white/20 pb-4 mb-10">
                <h2 className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] mix-blend-difference text-white">Entrance [ System ]</h2>
                <span className="font-mono text-xs opacity-50 text-white">v.0.1.0</span>
              </div>

              <div className="flex flex-col gap-4 text-white">
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-[0.15em] text-white leading-tight">
                  Public Beta
                </h3>
                <p className="font-mono text-sm md:text-base opacity-80 text-white tracking-[0.1em] uppercase">
                  March 14, 2025
                </p>
                <p className="font-mono text-[0.65rem] md:text-xs opacity-40 text-white tracking-[0.05em] uppercase leading-relaxed mt-2 max-w-sm">
                  A desktop-class study environment for serious gospel scholarship. Parallel translations, command-line navigation, offline-first.
                </p>
              </div>

              <div className="mt-8 text-center border-t border-white/10 pt-6">
                {!isMobile ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAlpha(prev => !prev);
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="interactive text-[0.6rem] uppercase tracking-widest opacity-40 hover:opacity-100 font-mono transition-opacity text-white bg-transparent border-none cursor-none"
                  >
                    Request Access_
                  </button>
                ) : (
                  <div className="font-mono text-[0.6rem] text-white opacity-40 uppercase tracking-widest">
                    Authentication requires desktop environment
                  </div>
                )}
              </div>
            </div>

            {/* Alpha Access Slide-out (Desktop Only) */}
            {!isMobile ? (
              <div className={`alpha-card-wrapper w-full max-w-lg mx-auto ${showAlpha ? "open" : ""}`}>
                <div>
                  <div className="bg-[#0a0a0a] bg-opacity-[0.85] p-6 md:p-8 border border-white/10 backdrop-blur-xl shadow-2xl relative z-20">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="font-mono text-[0.6rem] md:text-xs uppercase tracking-[0.15em] opacity-70 text-white">Alpha Testing Now Available</h2>
                      <span className="font-mono text-[0.5rem] opacity-30 text-white uppercase">Invite Only</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void signIn();
                      }}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      disabled={status === "loading"}
                      className="interactive w-full relative overflow-hidden group/btn bg-white text-black font-bold uppercase py-4 border border-transparent transition-all text-xs tracking-[0.2em] hover:bg-black hover:text-white hover:border-white flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      <span className="relative z-10 transition-transform group-hover/btn:translate-x-1 duration-300">
                        {status === "loading" ? "Initializing..." : "Sign in with Google"}
                      </span>
                      <span className="relative z-10 opacity-50 font-mono group-hover/btn:translate-x-1 duration-300 delay-75">
                        →
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-lg mx-auto mt-4 px-4 text-center">
                <p className="font-mono text-[0.65rem] text-[#ff3333] uppercase tracking-widest leading-relaxed">
                  Telos is currently a desktop-class experience. Please visit on a computer to sign in.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Fixed Edge Indicators */}
      <div className="edge-indicator edge-top-left">
        <div>DEV@TELOS.COM</div>
        <div ref={clockRef}>SLC, UT_00:00:00</div>
      </div>

      <div className="edge-indicator scroll-progress-container">
        <div className="scroll-progress-fill" ref={progressBarRef}></div>
      </div>

      <div className="edge-indicator edge-bottom-left">
        <span ref={mouseXRef}>0000 X 0000 W</span>
      </div>

      <div className="edge-indicator edge-right-center">
        <span ref={mouseYRef}>0000 Y 0000 H</span>
      </div>
    </div>
  );
}
