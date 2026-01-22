use crate::media_controls::{MediaControlEvent, MediaControlsPlatform, MediaMetadata, PlaybackState};
use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_foundation::{NSMutableDictionary, NSNumber, NSString};
use objc2_media_player::{
    MPChangePlaybackPositionCommandEvent, MPMediaItemPropertyAlbumTitle,
    MPMediaItemPropertyArtist, MPMediaItemPropertyPlaybackDuration, MPMediaItemPropertyTitle,
    MPNowPlayingInfoCenter, MPNowPlayingInfoPropertyElapsedPlaybackTime,
    MPNowPlayingInfoPropertyPlaybackRate, MPNowPlayingPlaybackState, MPRemoteCommandCenter,
    MPRemoteCommandEvent, MPRemoteCommandHandlerStatus,
};
use std::ptr::NonNull;
use tokio::sync::mpsc;

pub struct MacOSControls {
    _event_sender: mpsc::UnboundedSender<MediaControlEvent>,
    _handler_targets: Vec<Retained<AnyObject>>,
}

// Safety: The handler targets are ObjC objects retained for lifetime purposes only.
// They are set once during initialization and never mutated or accessed afterward.
// The event_sender is already Send+Sync.
unsafe impl Send for MacOSControls {}
unsafe impl Sync for MacOSControls {}

/// Helper: cast any objc2 object reference to &AnyObject.
/// Safety: All Objective-C objects share the same memory representation.
unsafe fn as_any_object<T>(obj: &T) -> &AnyObject {
    &*(obj as *const T as *const AnyObject)
}

/// Helper: set an object in an NSMutableDictionary using raw pointer casts.
unsafe fn dict_set(
    dict: &NSMutableDictionary<NSString, AnyObject>,
    key: &NSString,
    value: &AnyObject,
) {
    // Use msg_send to bypass the typed ProtocolObject<dyn NSCopying> requirement.
    // NSString conforms to NSCopying so this is valid at the ObjC level.
    let _: () = objc2::msg_send![dict, setObject: value, forKey: key];
}

impl MacOSControls {
    pub fn new(
        event_sender: mpsc::UnboundedSender<MediaControlEvent>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let center = unsafe { MPRemoteCommandCenter::sharedCommandCenter() };
        let mut handler_targets: Vec<Retained<AnyObject>> = Vec::new();

        // Play command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                eprintln!("[MediaControls] play handler fired!");
                let _ = sender.send(MediaControlEvent::Play);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.playCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Pause command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                let _ = sender.send(MediaControlEvent::Pause);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.pauseCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Toggle play/pause command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                eprintln!("[MediaControls] togglePlayPause handler fired!");
                let _ = sender.send(MediaControlEvent::PlayPause);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.togglePlayPauseCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Next track command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                let _ = sender.send(MediaControlEvent::Next);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.nextTrackCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Previous track command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                let _ = sender.send(MediaControlEvent::Previous);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.previousTrackCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Change playback position command (seek)
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |event: NonNull<MPRemoteCommandEvent>| {
                let position = unsafe {
                    let pos_event: NonNull<MPChangePlaybackPositionCommandEvent> = event.cast();
                    pos_event.as_ref().positionTime()
                };
                let _ = sender.send(MediaControlEvent::Seek(position));
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.changePlaybackPositionCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Stop command
        {
            let sender = event_sender.clone();
            let block: RcBlock<
                dyn Fn(NonNull<MPRemoteCommandEvent>) -> MPRemoteCommandHandlerStatus,
            > = RcBlock::new(move |_event: NonNull<MPRemoteCommandEvent>| {
                let _ = sender.send(MediaControlEvent::Stop);
                MPRemoteCommandHandlerStatus::Success
            });
            let cmd = unsafe { center.stopCommand() };
            unsafe { cmd.setEnabled(true) };
            let target = unsafe { cmd.addTargetWithHandler(&block) };
            handler_targets.push(target);
        }

        // Set initial playback state
        unsafe {
            let info_center = MPNowPlayingInfoCenter::defaultCenter();
            info_center.setPlaybackState(MPNowPlayingPlaybackState::Stopped);
        }

        eprintln!("[MediaControls] macOS media controls initialized successfully");

        Ok(MacOSControls {
            _event_sender: event_sender,
            _handler_targets: handler_targets,
        })
    }
}

impl MediaControlsPlatform for MacOSControls {
    fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String> {
        eprintln!("[MediaControls] update_metadata: title={}, artist={}, duration={}", metadata.title, metadata.artist, metadata.duration);
        unsafe {
            let info_center = MPNowPlayingInfoCenter::defaultCenter();
            let dict: Retained<NSMutableDictionary<NSString, AnyObject>> =
                NSMutableDictionary::new();

            // Title
            let title = NSString::from_str(&metadata.title);
            dict_set(&dict, MPMediaItemPropertyTitle, as_any_object(&*title));

            // Artist
            let artist = NSString::from_str(&metadata.artist);
            dict_set(&dict, MPMediaItemPropertyArtist, as_any_object(&*artist));

            // Album
            let album = NSString::from_str(&metadata.album);
            dict_set(&dict, MPMediaItemPropertyAlbumTitle, as_any_object(&*album));

            // Duration
            let duration = NSNumber::new_f64(metadata.duration);
            dict_set(
                &dict,
                MPMediaItemPropertyPlaybackDuration,
                as_any_object(&*duration),
            );

            // Playback rate (1.0 = normal speed)
            let rate = NSNumber::new_f64(1.0);
            dict_set(
                &dict,
                MPNowPlayingInfoPropertyPlaybackRate,
                as_any_object(&*rate),
            );

            info_center.setNowPlayingInfo(Some(&dict));
        }
        Ok(())
    }

    fn update_playback_state(&self, state: PlaybackState) -> Result<(), String> {
        unsafe {
            let info_center = MPNowPlayingInfoCenter::defaultCenter();
            let mp_state = match state {
                PlaybackState::Playing => MPNowPlayingPlaybackState::Playing,
                PlaybackState::Paused => MPNowPlayingPlaybackState::Paused,
                PlaybackState::Stopped => MPNowPlayingPlaybackState::Stopped,
            };
            info_center.setPlaybackState(mp_state);

            // Update playback rate in now playing info (required for progress bar)
            let rate = match state {
                PlaybackState::Playing => 1.0,
                _ => 0.0,
            };
            if let Some(existing) = info_center.nowPlayingInfo() {
                let dict: Retained<NSMutableDictionary<NSString, AnyObject>> =
                    NSMutableDictionary::dictionaryWithDictionary(&existing);
                let rate_num = NSNumber::new_f64(rate);
                dict_set(
                    &dict,
                    MPNowPlayingInfoPropertyPlaybackRate,
                    as_any_object(&*rate_num),
                );
                info_center.setNowPlayingInfo(Some(&dict));
            }
        }
        Ok(())
    }

    fn update_position(&self, position: f64) -> Result<(), String> {
        unsafe {
            let info_center = MPNowPlayingInfoCenter::defaultCenter();

            // Get existing now playing info or create new dict
            let dict: Retained<NSMutableDictionary<NSString, AnyObject>> =
                if let Some(existing) = info_center.nowPlayingInfo() {
                    NSMutableDictionary::dictionaryWithDictionary(&existing)
                } else {
                    NSMutableDictionary::new()
                };

            // Update elapsed playback time
            let elapsed = NSNumber::new_f64(position);
            dict_set(
                &dict,
                MPNowPlayingInfoPropertyElapsedPlaybackTime,
                as_any_object(&*elapsed),
            );

            info_center.setNowPlayingInfo(Some(&dict));
        }
        Ok(())
    }

    fn set_available_actions(&self, can_go_next: bool, can_go_previous: bool) -> Result<(), String> {
        unsafe {
            let center = MPRemoteCommandCenter::sharedCommandCenter();
            center.nextTrackCommand().setEnabled(can_go_next);
            center.previousTrackCommand().setEnabled(can_go_previous);
        }
        Ok(())
    }
}
