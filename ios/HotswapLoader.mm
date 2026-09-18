#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <arpa/inet.h>
#import <netinet/in.h>
#import <sys/socket.h>
#import <unistd.h>

#import "HotswapRebind.h"

static const int kPort = 8100;

static BOOL readExactly(int fd, void *into, size_t size) {
  uint8_t *cursor = (uint8_t *)into;
  size_t read = 0;

  while (read < size) {
    ssize_t chunk = recv(fd, cursor + read, size - read, 0);
    if (chunk <= 0) return NO;
    read += (size_t)chunk;
  }

  return YES;
}

static uint8_t loadImage(NSString *path) {
  void *image = dlopen(path.UTF8String, RTLD_NOW | RTLD_LOCAL);

  if (image == NULL) {
    NSLog(@"[Hotswap] dlopen failed: %s", dlerror());
    return 1;
  }

  size_t rebound = HotswapRebindSymbols(image);
  NSLog(@"[Hotswap] loaded %@, rebound %zu symbol(s)", path.lastPathComponent, rebound);

  return 0;
}

static void serveConnection(int client) {
  while (YES) {
    uint32_t length = 0;
    if (!readExactly(client, &length, sizeof(length))) return;
    length = ntohl(length);
    if (length == 0 || length > 4096) return;

    NSMutableData *buffer = [NSMutableData dataWithLength:length];
    if (!readExactly(client, buffer.mutableBytes, length)) return;

    NSString *path = [[NSString alloc] initWithData:buffer encoding:NSUTF8StringEncoding];
    uint8_t reply = loadImage(path);

    if (send(client, &reply, 1, 0) != 1) return;
  }
}

static void listenForever(void) {
  int server = socket(AF_INET, SOCK_STREAM, 0);
  if (server < 0) return;

  int reuse = 1;
  setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

  struct sockaddr_in address = {};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = htons(kPort);

  if (bind(server, (struct sockaddr *)&address, sizeof(address)) < 0) {
    NSLog(@"[Hotswap] could not bind port %d", kPort);
    close(server);
    return;
  }

  listen(server, 1);
  NSLog(@"[Hotswap] listening on 127.0.0.1:%d", kPort);

  while (YES) {
    int client = accept(server, NULL, NULL);
    if (client < 0) continue;
    serveConnection(client);
    close(client);
  }
}

/** Opens the socket on load, so installing the pod is the whole setup. */
@interface HotswapLoader : NSObject
@end

@implementation HotswapLoader

+ (void)load {
#if DEBUG
  [NSThread detachNewThreadWithBlock:^{
    listenForever();
  }];
#endif
}

@end
