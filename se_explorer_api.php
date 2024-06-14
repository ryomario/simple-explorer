<?php
ini_set('display_errors',1);

class SimpleExplorerAPI
{
    protected static $usercache = array(), $groupcache = array();

    public static function GetEntryHash($type, $file, &$info)
    {
        return md5($type . "|" . $file . "|" . $info["mode"] . "|" . $info["uid"] . "|" . $info["gid"] . "|" . $info["size"] . "|" . $info["mtime"]);
    }
    public static function GetLinkURI($file, $type, $options)
    {
        $path = self::GetRequestVar('path');
        if ($path === false)  return '';

        $path = @json_decode($path, true);
        if (!is_array($path))  return '';

        $result = array();

        foreach ($path as $id)
        {
            if (!is_string($id) || $id === "." || $id === "..")  return '';

            if ($id === "")  continue;

            $result[] = $id;
        }

        $result = rtrim($options['base_url'], "/") . "/" . implode("/", $result) . "/" . $file;
        if ($result === false)  return '';

        $result = str_replace("//", "/", $result);

        $result = str_replace("\\", "/", $result);

        return $result;
    }
    public static function BuildEntry($path, $file, $type, &$options)
    {
        $info = @stat($path . "/" . $file);
        if ($info === false)  return false;

        $entry = array(
            "id" => $file,
            "name" => $file,
            "type" => $type,
            "hash" => self::GetEntryHash($type, $file, $info),
            "link" => self::GetLinkURI($file, $type, $options),
            // "tooltip" => self::GetTooltip($path, $file, $options["windows"], $type, $info)
        );

        $detail = self::GetDetail($path, $file, $options["windows"], $type, $info);

        $entry = array_merge($entry, $detail);


        if ($type === "file")
        {
            $entry["size"] = $info["size"];
        }
        if ($type === "folder")  $entry['items_count'] = self::GetEntriesCount(($path . "/" . $file), $options);


        return $entry;
    }

    public static function GetTooltip($path, $file, $windows, $type, &$info)
    {
        return implode("\n", self::GetDetail($path, $file, $windows, $type, $info));
    }

    public static function GetDetail($path, $file, $windows, $type, &$info)
    {
        $detail = array();
        if (strlen($file) > 35)  $detail['name'] = $file;

        if (!$windows)
        {
            $type2 = $info["mode"] & 0170000;

            if ($type2 === 0100000)  $mode = "-";
            else if ($type2 === 0040000)  $mode = "d";
            else if ($type2 === 0140000)  $mode = "s";
            else if ($type2 === 0120000)  $mode = "l";
            else if ($type2 === 0060000)  $mode = "b";
            else if ($type2 === 0020000)  $mode = "c";
            else if ($type2 === 0010000)  $mode = "p";
            else  $mode = "u";

            $mode .= ($info["mode"] & 0x0100 ? "r" : "-");
            $mode .= ($info["mode"] & 0x0080 ? "w" : "-");
            $mode .= ($info["mode"] & 0x0040 ? ($info["mode"] & 0x0800 ? "s" : "x") : ($info["mode"] & 0x0800 ? "S" : "-"));

            $mode .= ($info["mode"] & 0x0020 ? "r" : "-");
            $mode .= ($info["mode"] & 0x0010 ? "w" : "-");
            $mode .= ($info["mode"] & 0x0008 ? ($info["mode"] & 0x0400 ? "s" : "x") : ($info["mode"] & 0x0400 ? "S" : "-"));

            $mode .= ($info["mode"] & 0x0004 ? "r" : "-");
            $mode .= ($info["mode"] & 0x0002 ? "w" : "-");
            $mode .= ($info["mode"] & 0x0001 ? ($info["mode"] & 0x0200 ? "t" : "x") : ($info["mode"] & 0x0200 ? "T" : "-"));

            $detail['mode'] = $mode;

            $username = self::GetUserName($info["uid"]);
            $groupname = self::GetGroupName($info["gid"]);

            if ($username === false)  $detail['owner'] = $info["uid"];
            else  $detail['owner'] = sprintf("%s (%u)", $username, $info["uid"]);

            if ($groupname === false)  $detail['group'] = $info["gid"];
            else  $detail['group'] = sprintf("%s (%u)", $groupname, $info["gid"]);
        }

        $detail["modified"] = date("d/m/Y H:i", $info["mtime"]);

        return $detail;
    }

    public static function GetUserName($uid)
    {
        if (!function_exists("posix_getpwuid"))  return "";

        if (!isset(self::$usercache[$uid]))
        {
            $user = @posix_getpwuid($uid);
            if ($user === false || !is_array($user))  self::$usercache[$uid] = false;
            else
            {
                self::$usercache[$uid] = $user;
                self::$usercache["_" . $user["name"]] = $user;
            }
        }

        $user = self::$usercache[$uid];

        return ($user !== false ? $user["name"] : "");
    }

    public static function GetGroupName($gid)
    {
        if (!function_exists("posix_getgrgid"))  return "";

        if (!isset(self::$groupcache[$gid]))
        {
            $group = @posix_getgrgid($gid);
            if ($group === false || !is_array($group))  self::$groupcache[$gid] = "";
            else
            {
                self::$groupcache[$gid] = $group;
                self::$groupcache["_" . $group["name"]] = $group;
            }
        }

        $group = self::$groupcache[$gid];

        return ($group !== false ? $group["name"] : "");
    }

    // Refresh folder.
    protected static function ProcessRefreshAction(&$options)
    {
        $path = self::GetSanitizedPath($options["base_dir"], "path", $options["dot_folders"]);

        if ($path === false)  $result = array("success" => false, "error" => "Invalid path specified.", "errorcode" => "invalid_path");
        else
        {
            $dir = @opendir($path);

            if (!$dir)  $result = array("success" => false, "error" => "The server was unable to open the path.", "errorcode" => "path_open_failed");
            else
            {
                if (is_array($options["allowed_exts"]))  $allowedexts = $options["allowed_exts"];
                else  $allowedexts = self::ExtractAllowedExtensions($options["allowed_exts"]);

                @set_time_limit(0);

                $result = array(
                    "success" => true,
                    "entries" => array()
                );

                while (($file = readdir($dir)) !== false)
                {
                    if ($file === "." || $file === "..")  continue;

                    if (is_dir($path . "/" . $file))
                    {
                        if ($file[0] !== "." || $options["dot_folders"])
                        {
                            $entry = self::BuildEntry($path, $file, "folder", $options);
                            if ($entry !== false)  $result["entries"][] = $entry;
                        }
                    }
                    else if (self::HasAllowedExt($allowedexts, $options["allow_empty_ext"], $file))
                    {
                        $entry = self::BuildEntry($path, $file, "file", $options);
                        if ($entry !== false)  $result["entries"][] = $entry;
                    }
                }

                closedir($dir);
            }
        }

        return $result;
    }
    
    public static function HasAllowedExt(&$allowedexts, $allowempty, $file)
    {
        if ($allowedexts === false)  return false;
        if ($allowedexts === true)  return true;

        $pos = strrpos($file, ".");
        if ($pos === false)
        {
            if (!$allowempty)  return false;
        }
        else
        {
            $ext = strtolower(substr($file, $pos + 1));
            if (!isset($allowedexts[$ext]))  return false;
        }

        return true;
    }
    
    public static function GetEntriesCount($path,$options)
    {
        if ($path === false)  return false;
        else
        {
            $dir = @opendir($path);

            if (!$dir)  return false;
            else
            {
                if (is_array($options["allowed_exts"]))  $allowedexts = $options["allowed_exts"];
                else  $allowedexts = self::ExtractAllowedExtensions($options["allowed_exts"]);

                @set_time_limit(0);

                $count = 0;

                while (($file = readdir($dir)) !== false)
                {
                    if ($file === "." || $file === "..")  continue;

                    if (is_dir($path . "/" . $file))
                    {
                        if ($file[0] !== "." || $options["dot_folders"])
                        {
                            $count += 1;
                        }
                    }
                    else if (self::HasAllowedExt($allowedexts, $options["allow_empty_ext"], $file))
                    {
                        $count += 1;
                    }
                }

                closedir($dir);
                return $count;
            }
        }

        return false;
    }

    public static function ExtractAllowedExtensions($exts)
    {
        $result = array();
        $exts2 = explode(",", $exts);
        foreach ($exts2 as $ext)
        {
            $ext = trim($ext);
            $ext = trim($ext, ".");

            if ($ext !== "")  $result[strtolower($ext)] = true;
        }

        return $result;
    }

    public static function GetSanitizedPath($basedir, $name, $allowdotfolders = false, $extrapath = "")
    {
        $path = self::GetRequestVar($name);
        if ($path === false)  return false;

        $path = @json_decode($path, true);
        if (!is_array($path))  return false;

        $result = array();

        foreach ($path as $id)
        {
            if (!is_string($id) || $id === "." || $id === "..")  return false;

            if ($id === "")  continue;

            if ($id[0] === "." && !$allowdotfolders)  return false;

            $result[] = $id;
        }

        $result = @realpath(rtrim($basedir, "/") . "/" . implode("/", $result));
        if ($result === false)  return false;

        $result = str_replace("\\", "/", $result);
        if (strncmp($result . "/", $basedir . "/", strlen($basedir) + 1))  return false;

        if ($extrapath !== "")  $result .= "/" . $extrapath;

        return $result;
    }

    public static function HandleActions($requestvar, $requestprefix, $basedir, $options)
    {
        $action = self::GetRequestVar($requestvar);
        if($action === false)return false;

        if(!is_dir($basedir))return array("success" => false, "error" => "Supplied base directory does not exist.", "errorcode" => "invalid_base_dir");

        // Normalize options.
        $options["action"] = $action;
        $options["requestprefix"] = $requestprefix;
        $options["base_dir"] = str_replace("\\", "/", realpath($basedir));

        if (isset($options["base_url"]))  $options["base_url"] = rtrim($options["base_url"], "/");

        if (!isset($options["allowed_exts"]))  $options["allowed_exts"] = true;
        if (!isset($options["allow_empty_ext"]))  $options["allow_empty_ext"] = true;
        if (!isset($options["dot_folders"]))  $options["dot_folders"] = false;

        $options["started"] = time();

        $os = php_uname("s");
        $windows = (strtoupper(substr($os, 0, 3)) == "WIN");

        $options["windows"] = $windows;

        // Process actions.
        if ($action === $requestprefix . "refresh")  $result = self::ProcessRefreshAction($options);
        else  $result = false;

        // Dump response to network.
        if ($result !== false)
        {
            if (!headers_sent())  header("Content-Type: application/json");

            echo json_encode($result, JSON_UNESCAPED_SLASHES);

            exit();
        }

        return false;
    }

    public static function GetRequestVar($name)
    {
        if(isset($_POST[$name]))return $_POST[$name];
        if(isset($_GET[$name]))return $_GET[$name];
        return false;
    }
}