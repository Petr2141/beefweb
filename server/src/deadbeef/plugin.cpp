#include "plugin.hpp"
#include "../log.hpp"

#define CONF_PORT           MSRV_PROJECT_ID ".port"
#define CONF_ALLOW_REMOTE   MSRV_PROJECT_ID ".allow_remote"
#define CONF_MUSIC_DIRS     MSRV_PROJECT_ID ".music_dirs"

namespace msrv {
namespace deadbeef_plugin {

namespace {

DB_misc_t pluginDef;
Plugin* pluginInstance;

constexpr char pluginConfigDialog[] =
    "property \"Network port\" entry " CONF_PORT " 8880;"
    "property \"Allow remote connections\" checkbox " CONF_ALLOW_REMOTE " 1;"
    "property \"Music directories\" entry " CONF_MUSIC_DIRS " \"\";";

}

Plugin::Plugin()
{
    pluginDir = getModulePath(&pluginDef).parent_path();

    player_.reset(new PlayerImpl());
    host_.reset(new Host(player_.get()));

    reloadConfig();
    host_->reconfigure(settings_);
}

Plugin::~Plugin()
{
}

bool Plugin::reloadConfig()
{
    ConfigMutex mutex;
    ConfigLockGuard lock(mutex);

    int port = ddbApi->conf_get_int(CONF_PORT, 8880);
    bool allowRemote = ddbApi->conf_get_int(CONF_ALLOW_REMOTE, 1) != 0;
    const char* musicDirs = ddbApi->conf_get_str_fast(CONF_MUSIC_DIRS, "");

    if (settings_.port == port &&
        settings_.allowRemote == allowRemote &&
        musicDirs_ == musicDirs)
    {
        return false;
    }

    settings_.port = port;
    settings_.allowRemote = allowRemote;
    musicDirs_ = musicDirs;
    settings_.musicDirs.clear();
    settings_.musicDirs = parseValueList<std::string>(musicDirs_, ';');

    if (!pluginDir.empty())
        settings_.staticDir = pathToUtf8(pluginDir / pathFromUtf8(MSRV_WEB_ROOT));
    else
        settings_.staticDir = std::string();

    return true;
}

void Plugin::connect()
{
    player_->connect();
}

void Plugin::disconnect()
{
    player_->disconnect();
}

void Plugin::handleMessage(uint32_t id, uintptr_t ctx, uint32_t p1, uint32_t p2)
{
    if (id == DB_EV_CONFIGCHANGED && reloadConfig())
        host_->reconfigure(settings_);

    player_->handleMessage(id, ctx, p1, p2);
}

static int pluginStart()
{
    return tryCatchLog([] { pluginInstance = new Plugin(); }) ? 0 : -1;
}

static int pluginStop()
{
    if (pluginInstance)
    {
        tryCatchLog([] { delete pluginInstance; });
        pluginInstance = nullptr;
    }

    return 0;
}

static int pluginConnect()
{
    return tryCatchLog([] { pluginInstance->connect(); }) ? 0 : -1;
}

static int pluginDisconnect()
{
    return tryCatchLog([] { pluginInstance->disconnect(); }) ? 0 : -1;
}

static int pluginMessage(uint32_t id, uintptr_t ctx, uint32_t p1, uint32_t p2)
{
    return tryCatchLog([&] { pluginInstance->handleMessage(id, ctx, p1, p2); }) ? 0 : -1;
}

static void pluginInitDef()
{
    if (pluginDef.plugin.api_vmajor)
        return;

    pluginDef.plugin.api_vmajor = 1;
    pluginDef.plugin.api_vminor = DDB_API_LEVEL;
    pluginDef.plugin.version_major = 0;
    pluginDef.plugin.version_minor = 1;
    pluginDef.plugin.type = DB_PLUGIN_MISC;
    pluginDef.plugin.id = MSRV_PROJECT_ID;
    pluginDef.plugin.name = MSRV_PROJECT_NAME;
    pluginDef.plugin.descr = MSRV_PROJECT_DESC;
    pluginDef.plugin.copyright = MSRV_LICENSE_TEXT;
    pluginDef.plugin.website = MSRV_PROJECT_URL;
    pluginDef.plugin.start = pluginStart;
    pluginDef.plugin.stop = pluginStop;
    pluginDef.plugin.connect = pluginConnect;
    pluginDef.plugin.disconnect = pluginDisconnect;
    pluginDef.plugin.message = pluginMessage;
    pluginDef.plugin.configdialog = pluginConfigDialog;
}

extern "C" MSRV_EXPORT DB_plugin_t* MSRV_PREFIXED(load)(DB_functions_t* api)
{
    static StderrLogger logger(MSRV_PROJECT_ID);
    Logger::setCurrent(&logger);

    ddbApi = api;
    pluginInitDef();
    return DB_PLUGIN(&pluginDef);
}

}}
