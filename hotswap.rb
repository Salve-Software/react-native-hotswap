# Adds the flags Swift replacement needs, on the final link, which a podspec cannot reach.
def hotswap_post_install(installer)
  projects = [installer.pods_project] + installer.aggregate_targets.map(&:user_project)

  projects.compact.uniq.each do |project|
    project.targets.each do |target|
      target.build_configurations.each do |config|
        next unless config.name.downcase.include?('debug')

        hotswap_append(config, 'OTHER_LDFLAGS', ['-Xlinker', '-interposable'], '-interposable')
        hotswap_append(
          config,
          'OTHER_SWIFT_FLAGS',
          ['-Xfrontend', '-enable-implicit-dynamic', '-Xfrontend', '-enable-private-imports'],
          '-enable-implicit-dynamic',
        )
      end
    end

    project.save
  end
end

# Xcode hands settings back as an array or one joined string, and membership on the
# string form never matches.
def hotswap_append(config, key, flags, marker)
  current = config.build_settings[key] || ['$(inherited)']
  current = [current] if current.is_a?(String)

  return if current.join(' ').include?(marker)

  config.build_settings[key] = current + flags
end
