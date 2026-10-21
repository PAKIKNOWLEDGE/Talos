/**
 * Braille-mono Collapsal splash, generated locally from reviewed pixel art.
 * Three widths so the welcome hero can drop rows without filling the paper
 * with background noise. Keep these as literal Unicode rows.
 */
export const COLLAPSAL_WELCOME_ART = {
  hero: {
    fullMinWidth: 44,
    mediumMinWidth: 34,
    microMinWidth: 22,
    fallbackTitle: 'Talos',
  },
  large: [
    '          ⣀⣀    ⣤⣤⣤⣤⣤⣄⣤⣶⣶⣶⣤⣤⣤⡄     ⡄',
    '       ⢀⣠⣿⣿⣿⣿⣷⡶⠛⠛⠋⠉⢉⡉⠉⠉⠉⠉⣉⠙⢻⣿⣷⣆   ⠉⠏⠁',
    '  ⢀⣀ ⠰⣿⣿⣿⣿⡿⠿⠉      ⠈⠉⢁  ⠈⣉⡀  ⠙⢻⠿⣷⣶⣤⣄⣀',
    ' ⠈⠹ ⢠⣤⣿⡿⠟⠉    ⢘⣶⣄⣀⣀⣤⠴⠞⣤⣠⣄⠤⠙⠓⠒⠚⠛⠛⢻⣯⠉⠛⠋',
    '    ⠘⠻⣿⣧⡔⣀   ⠈⠉⠉⠁                ⢸⣤',
    '    ⠶⢾⣿⡏⠙⣤⣦⣤                    ⢀⣸⣿⣶⡆',
    '⣶⣶⣶⣶⣾⣿⣿⣷⣆⠛⠿⠿⣒                  ⣀⡞⠋⠉⠁',
    ' ⠙⢻⣿⣿⣿⣿⣿⣿⣿⣶⣾⣉⣊⣁⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣠⣤⡔⠚⠉',
    '   ⠉⠿⠿⠿⠋⠁    ⠈⠉⠛⠛⠛⠋⠉      ⠈⠉⠉⠁',
  ],
  medium: [
    '                  ⣀⣀⡀',
    '       ⣤⣶⣦⣤⣀⣴⣿⠿⠷⠶⠾⠿⠿⠿⣶⣶⣆   ⢴⡦',
    ' ⢀⡀ ⣴⣶⣿⣿⣿⠟⠉⠁   ⠘⠒⡀ ⠒⡃⠈⠉⠻⣷⣶⣤⣀⣀⡀',
    ' ⠺⠏⢠⣼⣿⠿⠛⠁  ⢰⣤⣀⣀⡤⠤⢧⣠⣀⠝⠦⠤⠴⠓⠘⣿⠻⠿⠃',
    '   ⠘⣻⣿⣖⠤   ⠉⠉             ⢸⡆',
    '   ⢚⣿⣿⠈⣿⣷⡆                ⣼⣿⡷',
    '⠻⣿⣿⣿⣿⣿⣷⣤⣉⣵⣀⠄          ⣀⣀⠴⠞',
    ' ⠘⠛⣿⣿⡿⠛⠛⠛⠓⠒⠒⠶⠶⠖⠒⠒⠒⠒⠒⠒⠚⠛⠃',
  ],
  small: [
    '            ⣀⡀',
    '     ⣴⣦⣄⣴⡿⠷⠾⠿⠿⣶⡆ ⠠⡆',
    ' ⢀ ⣴⣾⣿⠟⠁  ⠘⡀⠐⡃⠉⢻⣶⣄⣀',
    ' ⠸⠁⣼⡿⠋ ⠰⣤⣀⡤⢧⣀⠝⠤⠜⠚⡟⠟',
    '   ⣻⣗⠄ ⠈⠉        ⣷',
    '  ⠐⣿⡏⣿⡆          ⣿⡇',
    '⠘⢿⣿⣿⣷⣌⣵⡀      ⢀⡠⠞',
    ' ⠘⢻⣿⠟⠛⠓⠒⠶⠖⠒⠒⠒⠒⠛⠃',
  ],
} as const;

export function collapsalWelcomeArt(width: number): readonly string[] {
  const { fullMinWidth, mediumMinWidth, microMinWidth, fallbackTitle } = COLLAPSAL_WELCOME_ART.hero;
  if (width >= fullMinWidth) return COLLAPSAL_WELCOME_ART.large;
  if (width >= mediumMinWidth) return COLLAPSAL_WELCOME_ART.medium;
  if (width >= microMinWidth) return COLLAPSAL_WELCOME_ART.small;
  return [fallbackTitle];
}
