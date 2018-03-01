#include "utils.hpp"
#include "../project_info.hpp"

namespace msrv {
namespace player_foobar2000 {

Fb2kLogger::Fb2kLogger()
    : prefix_(std::string(MSRV_PROJECT_ID) + ": ")
{
}

Fb2kLogger::~Fb2kLogger() = default;

void Fb2kLogger::log(LogLevel, const char* fmt, va_list va)
{
    console::printfv((prefix_ + fmt).c_str(), va);
}

Fb2kWorkQueue::Fb2kWorkQueue() = default;
Fb2kWorkQueue::~Fb2kWorkQueue() = default;

void Fb2kWorkQueue::callback_run()
{
    execute();
}

void Fb2kWorkQueue::schedule()
{
    callback_enqueue();
}

}}