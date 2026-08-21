import main_test2

# Check DRM data in memory
test_apps = ['252490', '359550', '553850', '1808500', '2715900', '3405690', '10', '440']
for appid in test_apps:
    data = main_test2._ALL_GAMES_DATA.get(appid, {})
    print(f"{appid}: drm={data.get('drm', 'NOT FOUND')}, name={data.get('name', 'N/A')}")