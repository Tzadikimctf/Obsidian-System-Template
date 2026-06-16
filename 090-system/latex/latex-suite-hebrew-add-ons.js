[
    // -------------------------------------------------------------
    // HEBREW LATEX AUTO-WRAP (Write Hebrew inside Math Blocks)
    // -------------------------------------------------------------
    // Automatically wraps any Hebrew word in \text{...} when you press space in math mode.
    // This allows writing Hebrew explanations inside math blocks naturally.
    {trigger: /([א-ת]+)\s/, replacement: "\\text{[[0]]} ", options: "rmA"},

    // -------------------------------------------------------------
    // HEBREW KEYBOARD LAYOUT TRIGGERS (Type math without switching layouts)
    // -------------------------------------------------------------
    // Core Mode Triggers
    {trigger: "צל", replacement: "$$0$", options: "tA"},         // Equivalent to 'mk' (inline math)
    {trigger: "גצ", replacement: "$$\n$0\n$$", options: "tAw"},  // Equivalent to 'dm' (display math)
    {trigger: "נקע", replacement: "\\begin{$0}\n$1\n\\end{$0}", options: "mA"}, // Equivalent to 'beg'
    {trigger: "..", replacement: "\\frac{$0}{$1}$2", options: "mA"}, // Equivalent to '//' (on Hebrew key layout, physical / types .)

    // Basic Operations & Modifiers
    {trigger: "דק", replacement: "^{2}", options: "mA"},        // Equivalent to 'sr' (square)
    {trigger: "בנ", replacement: "^{3}", options: "mA"},        // Equivalent to 'cb' (cube)
    {trigger: "רק", replacement: "^{$0}$1", options: "mA"},      // Equivalent to 'rd' (power)
    {trigger: "סא", replacement: "\\sqrt{ $0 }$1", options: "mA"}, // Equivalent to 'sq' (sqrt)
    {trigger: "קק", replacement: "e^{ $0 }$1", options: "mA"},   // Equivalent to 'ee' (exponential)

    // Greek Letters (Mapped to physical keys matching English layout)
    {trigger: "@ש", replacement: "\\alpha", options: "mA"},     // @a
    {trigger: "@נ", replacement: "\\beta", options: "mA"},      // @b
    {trigger: "@ע", replacement: "\\gamma", options: "mA"},     // @g
    {trigger: "@ג", replacement: "\\delta", options: "mA"},     // @d
    {trigger: "@ק", replacement: "\\epsilon", options: "mA"},   // @e
    {trigger: "@ז", replacement: "\\zeta", options: "mA"},      // @z
    {trigger: "@א", replacement: "\\theta", options: "mA"},     // @t
    {trigger: "@ן", replacement: "\\iota", options: "mA"},      // @i
    {trigger: "@ל", replacement: "\\kappa", options: "mA"},     // @k
    {trigger: "@ך", replacement: "\\lambda", options: "mA"},    // @l
    {trigger: "@ד", replacement: "\\sigma", options: "mA"},     // @s
    {trigger: "@ו", replacement: "\\upsilon", options: "mA"},    // @u
    {trigger: "@ם", replacement: "\\omega", options: "mA"},     // @o
    {trigger: "@מ", replacement: "\\Omega", options: "mA"},     // @O

    // Standard STEM Symbols
    {trigger: "םםם", replacement: "\\infty", options: "mA"},    // ooo (infinity)
    {trigger: "ךןצ", replacement: "\\lim_{ ${0:n} \\to ${1:\\infty} } $2", options: "mA"}, // lim
    {trigger: "סמצ", replacement: "\\sum_{${0:i}=${1:1}}^{${2:n}} $3", options: "m"}, // sum
    {trigger: "פרא", replacement: "\\prod_{${0:i}=${1:1}}^{${2:N}} $3", options: "m"}  // prod
]
