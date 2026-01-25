// Profile Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (handled by navigation.js mostly, but good to ensure)
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        updateProfileDisplay(user);
    }
});

function updateProfileDisplay(user) {
    const profileName = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');

    if (profileName) {
        profileName.textContent = user.name;
    }

    if (profileAvatar) {
        // Get initials from name
        const initials = user.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        profileAvatar.textContent = initials;
    }
}

function switchProfileTab(tab) {
  // Update active tab styling
  const tabs = document.querySelectorAll('.selector-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeTab = document.querySelector(`.selector-tab[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // TODO: Fetch and display content for the selected tab
  console.log(`Switching to ${tab} tab`);
}
