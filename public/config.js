/**
 * Boundary Rendering Configuration
 * Fiddle with these settings to adjust the visual style of the property boundary.
 */
window.boundaryConfig = {
    // Fill Settings
    showFill: false,
    fillColor: '#FFFF00', // Yellow
    fillOpacity: 0.2,

    // Polyline Settings
    // type options: 'solid', 'glow', 'dash', 'outline', 'arrow'
    type: 'solid', 
    width: 8,
    color: '#FFFF00', // Yellow

    // Glow Options (used if type is 'glow')
    glowPower: 0.2,
    taperPower: 1.0,

    // Dash Options (used if type is 'dash')
    dashLength: 16,
    gapColor: '#00000000', // Transparent

    // Outline Options (used if type is 'outline')
    outlineColor: '#000000',
    outlineWidth: 2
};
